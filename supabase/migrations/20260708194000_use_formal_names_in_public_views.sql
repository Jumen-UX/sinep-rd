create or replace function public.add_honorific_to_semicolon_list(value text, prefix text)
returns text
language sql
immutable
as $$
  select case
    when value is null or btrim(value) = '' then value
    else (
      select string_agg(
        case
          when normalize(parts.item) = 'vacante' or normalize(parts.item) like 'sede vacante%' then parts.item
          when normalize(parts.item) like normalize(prefix) || '%' then parts.item
          else btrim(prefix) || ' ' || parts.item
        end,
        '; ' order by parts.ordinality
      )
      from (
        select btrim(raw_item) as item, ordinality
        from unnest(string_to_array(value, ';')) with ordinality as values(raw_item, ordinality)
        where btrim(raw_item) <> ''
      ) as parts
    )
  end
$$;

create or replace view public.public_dioceses as
 SELECT ee.id,
    et.key AS entity_type_key,
    et.name AS entity_type_name,
    ee.name,
    ee.official_name,
    ee.slug,
    ee.description,
    ee.latin_name,
    ee.cathedral_name,
    public.add_honorific_to_semicolon_list(ee.current_ordinary_name, 'Mons.') AS current_ordinary_name,
    ee.current_ordinary_title,
    ee.territory_summary,
    ee.area_km2,
    ee.statistics_year,
    ee.population_total,
    ee.catholics_total,
    ee.catholics_percent,
    ee.parishes_count,
    ee.source_name,
    ee.source_url,
    ee.source_checked_at,
    ee.country,
    ee.province,
    ee.municipality,
    ee.address,
    ee.email,
    ee.phone,
    ee.website,
    ee.facebook_url,
    ee.instagram_url,
    ee.youtube_url,
    ee.erected_at,
        CASE
            WHEN parent_type.key = 'ecclesiastical_province'::text THEN parent.name
            ELSE NULL::text
        END AS ecclesiastical_province_name,
        CASE
            WHEN parent_type.key = 'ecclesiastical_province'::text THEN parent.slug
            ELSE NULL::text
        END AS ecclesiastical_province_slug,
    er.relationship_type,
    ee.created_at,
    ee.updated_at
   FROM ecclesiastical_entities ee
     JOIN entity_types et ON et.id = ee.entity_type_id
     LEFT JOIN entity_relationships er ON er.child_entity_id = ee.id AND er.is_current = true AND er.status = 'active'::text
     LEFT JOIN ecclesiastical_entities parent ON parent.id = er.parent_entity_id
     LEFT JOIN entity_types parent_type ON parent_type.id = parent.entity_type_id
  WHERE (et.key = ANY (ARRAY['archdiocese'::text, 'diocese'::text, 'military_ordinariate'::text])) AND ee.visibility = 'public'::text AND ee.status = 'active'::text AND (parent.id IS NULL OR (parent_type.key = ANY (ARRAY['ecclesiastical_province'::text, 'country'::text])));

create or replace view public.public_position_assignments as
 SELECT pa.id,
    pa.person_id,
    coalesce(p.formal_display_name, p.display_name) AS person_name,
    p.slug AS person_slug,
    p.person_type,
    pa.office_configuration_id,
    COALESCE(pa.title_override, oc.display_name) AS position_title,
    oc.key AS office_configuration_key,
    br.name AS base_role_name,
    sc.name AS scope_name,
    cat.name AS category_name,
    ch.name AS organization_chart_name,
    ch.key AS organization_chart_key,
    ou.name AS organization_unit_name,
    ee.name AS ecclesiastical_entity_name,
    ee.slug AS ecclesiastical_entity_slug,
    pe.name AS pastoral_entity_name,
    pe.slug AS pastoral_entity_slug,
    pred.person_id AS predecessor_person_id,
    coalesce(pred_person.formal_display_name, pred_person.display_name) AS predecessor_person_name,
    pred_person.slug AS predecessor_person_slug,
    succ.person_id AS successor_person_id,
    coalesce(succ_person.formal_display_name, succ_person.display_name) AS successor_person_name,
    succ_person.slug AS successor_person_slug,
    pa.start_date,
    pa.term_start_date,
    pa.term_end_date,
    pa.actual_end_date,
    pa.is_current,
    pa.assignment_status,
    pa.selection_method,
    pa.notes_public,
    pa.verification_status,
    pa.effective_date,
    pa.public_from,
    pa.public_until
   FROM position_assignments pa
     LEFT JOIN persons p ON p.id = pa.person_id
     JOIN office_configurations oc ON oc.id = pa.office_configuration_id
     JOIN office_base_roles br ON br.id = oc.base_role_id
     JOIN office_scopes sc ON sc.id = oc.scope_id
     JOIN office_categories cat ON cat.id = oc.category_id
     LEFT JOIN organization_charts ch ON ch.id = pa.organization_chart_id
     LEFT JOIN organization_units ou ON ou.id = pa.organization_unit_id
     LEFT JOIN ecclesiastical_entities ee ON ee.id = pa.ecclesiastical_entity_id
     LEFT JOIN pastoral_entities pe ON pe.id = pa.pastoral_entity_id
     LEFT JOIN position_assignments pred ON pred.id = pa.predecessor_assignment_id
     LEFT JOIN persons pred_person ON pred_person.id = pred.person_id
     LEFT JOIN position_assignments succ ON succ.id = pa.successor_assignment_id
     LEFT JOIN persons succ_person ON succ_person.id = succ.person_id
  WHERE pa.record_status = 'active'::text AND pa.visibility = 'public'::text AND pa.publication_status = 'published'::text AND COALESCE(pa.public_from, pa.start_date, pa.term_start_date, CURRENT_DATE) <= CURRENT_DATE AND (pa.public_until IS NULL OR pa.public_until >= CURRENT_DATE);
