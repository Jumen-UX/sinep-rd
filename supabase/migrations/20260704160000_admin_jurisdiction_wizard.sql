-- Admin module: transactional jurisdiction wizard.
-- This migration was applied to project hrvgpceqaxujlttpimdz on 2026-07-04.

create or replace function public.admin_save_jurisdiction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_type_key text := nullif(payload->>'entity_type_key', '');
  v_entity_type_id uuid;
  v_entity_id uuid;
  v_slug text := nullif(btrim(payload->>'slug'), '');
  v_name text := nullif(btrim(payload->>'name'), '');
  v_parent_id uuid := nullif(payload->>'parent_entity_id', '')::uuid;
  v_erected_at date := nullif(payload->>'erected_at', '')::date;
  v_relationship_type text;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar jurisdicciones' using errcode = '42501';
  end if;

  if v_type_key not in (
    'country',
    'ecclesiastical_province',
    'archdiocese',
    'diocese',
    'military_ordinariate',
    'vicariate',
    'deanery',
    'pastoral_region',
    'pastoral_zone'
  ) then
    raise exception 'Tipo de jurisdicción no permitido' using errcode = '22023';
  end if;

  if v_name is null or v_slug is null then
    raise exception 'Nombre y slug son obligatorios' using errcode = '22023';
  end if;

  select id
  into v_entity_type_id
  from public.entity_types
  where key = v_type_key
    and status = 'active';

  if v_entity_type_id is null then
    raise exception 'No se encontró el tipo de jurisdicción solicitado' using errcode = '22023';
  end if;

  insert into public.ecclesiastical_entities (
    entity_type_id,
    name,
    official_name,
    slug,
    description,
    country,
    province,
    municipality,
    sector,
    address,
    email,
    phone,
    website,
    latin_name,
    cathedral_name,
    current_ordinary_name,
    current_ordinary_title,
    territory_summary,
    area_km2,
    statistics_year,
    population_total,
    catholics_total,
    catholics_percent,
    parishes_count,
    source_name,
    source_url,
    source_checked_at,
    erected_at,
    status,
    visibility,
    created_by
  ) values (
    v_entity_type_id,
    v_name,
    nullif(btrim(payload->>'official_name'), ''),
    v_slug,
    nullif(btrim(payload->>'description'), ''),
    coalesce(nullif(btrim(payload->>'country'), ''), 'República Dominicana'),
    nullif(btrim(payload->>'province'), ''),
    nullif(btrim(payload->>'municipality'), ''),
    nullif(btrim(payload->>'sector'), ''),
    nullif(btrim(payload->>'address'), ''),
    nullif(btrim(payload->>'email'), ''),
    nullif(btrim(payload->>'phone'), ''),
    nullif(btrim(payload->>'website'), ''),
    nullif(btrim(payload->>'latin_name'), ''),
    nullif(btrim(payload->>'cathedral_name'), ''),
    nullif(btrim(payload->>'current_ordinary_name'), ''),
    nullif(btrim(payload->>'current_ordinary_title'), ''),
    nullif(btrim(payload->>'territory_summary'), ''),
    nullif(payload->>'area_km2', '')::numeric,
    nullif(payload->>'statistics_year', '')::integer,
    nullif(payload->>'population_total', '')::integer,
    nullif(payload->>'catholics_total', '')::integer,
    nullif(payload->>'catholics_percent', '')::numeric,
    nullif(payload->>'parishes_count', '')::integer,
    nullif(btrim(payload->>'source_name'), ''),
    nullif(btrim(payload->>'source_url'), ''),
    nullif(payload->>'source_checked_at', '')::date,
    v_erected_at,
    'active',
    'public',
    v_user_id
  )
  returning id, slug into v_entity_id, v_slug;

  if v_parent_id is not null then
    v_relationship_type := case
      when v_type_key = 'archdiocese' then 'metropolitan_see'
      when v_type_key = 'diocese' then 'suffragan_see'
      when v_type_key = 'military_ordinariate' then 'national_jurisdiction'
      else 'contains'
    end;

    insert into public.entity_relationships (
      parent_entity_id,
      child_entity_id,
      relationship_type,
      start_date,
      is_current,
      status,
      notes,
      created_by
    ) values (
      v_parent_id,
      v_entity_id,
      v_relationship_type,
      coalesce(v_erected_at, current_date),
      true,
      'active',
      'Relación creada desde asistente transaccional de nueva jurisdicción.',
      v_user_id
    );
  end if;

  perform public.admin_mark_missing_fields(
    'ecclesiastical_entities',
    v_entity_id,
    payload->'not_identified_fields',
    array[
      'official_name',
      'latin_name',
      'cathedral_name',
      'current_ordinary_name',
      'current_ordinary_title',
      'territory_summary',
      'area_km2',
      'statistics_year',
      'population_total',
      'catholics_total',
      'catholics_percent',
      'parishes_count',
      'source_name',
      'erected_at'
    ],
    'Marcado como no identificado desde el asistente transaccional de nueva jurisdicción.',
    v_user_id
  );

  return jsonb_build_object('entity_id', v_entity_id, 'slug', v_slug, 'entity_type_key', v_type_key);
end;
$$;

grant execute on function public.admin_save_jurisdiction(jsonb) to authenticated;
