alter table public.ecclesiastical_entities
  add column if not exists country_iso2 char(2);

update public.ecclesiastical_entities
set country_iso2 = 'DO'
where country_iso2 is null
  and (country = 'República Dominicana' or country is null);

alter table public.ecclesiastical_entities
  drop constraint if exists ecclesiastical_entities_country_iso2_fkey;

alter table public.ecclesiastical_entities
  add constraint ecclesiastical_entities_country_iso2_fkey
  foreign key (country_iso2)
  references public.countries(iso2);

comment on column public.ecclesiastical_entities.country_iso2 is 'Código ISO 3166-1 alpha-2 del país asociado a la entidad eclesiástica.';

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
    coalesce(c.name, ee.country) as country,
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
    ee.updated_at,
    ee.country_iso2,
    c.name as country_name
   FROM ecclesiastical_entities ee
     JOIN entity_types et ON et.id = ee.entity_type_id
     LEFT JOIN countries c ON c.iso2 = ee.country_iso2
     LEFT JOIN entity_relationships er ON er.child_entity_id = ee.id AND er.is_current = true AND er.status = 'active'::text
     LEFT JOIN ecclesiastical_entities parent ON parent.id = er.parent_entity_id
     LEFT JOIN entity_types parent_type ON parent_type.id = parent.entity_type_id
  WHERE (et.key = ANY (ARRAY['archdiocese'::text, 'diocese'::text, 'military_ordinariate'::text])) AND ee.visibility = 'public'::text AND ee.status = 'active'::text AND (parent.id IS NULL OR (parent_type.key = ANY (ARRAY['ecclesiastical_province'::text, 'country'::text])));
