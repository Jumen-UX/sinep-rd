create or replace function internal.admin_save_ecclesiastical_entity(payload jsonb)
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
  v_slug text;
  v_name text := nullif(btrim(payload->>'name'), '');
  v_parent_id uuid := nullif(payload->>'parent_entity_id', '')::uuid;
  v_erected_at date := nullif(payload->>'erected_at', '')::date;
  v_country_iso2 char(2) := nullif(upper(btrim(payload->>'country_iso2')), '')::char(2);
  v_country_name text := nullif(btrim(payload->>'country'), '');
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar entidades' using errcode = '42501';
  end if;

  if v_type_key not in ('parish', 'chapel') then
    raise exception 'Tipo de entidad no permitido para este asistente' using errcode = '22023';
  end if;

  if v_name is null then
    raise exception 'El nombre es obligatorio' using errcode = '22023';
  end if;

  v_slug := public.generate_unique_ecclesiastical_entity_slug(v_name, payload->>'slug');

  if v_country_iso2 is null and v_country_name is not null then
    select iso2, name
      into v_country_iso2, v_country_name
    from public.countries
    where name = v_country_name
      and status = 'active'
    limit 1;
  end if;

  if v_country_iso2 is null then
    select iso2, name
      into v_country_iso2, v_country_name
    from public.countries
    where iso2 = 'DO'
      and status = 'active'
    limit 1;
  end if;

  select name
    into v_country_name
  from public.countries
  where iso2 = v_country_iso2
    and status = 'active';

  if v_country_iso2 is null or v_country_name is null then
    raise exception 'Debes seleccionar un país habilitado en SINEP' using errcode = '22023';
  end if;

  select id
  into v_entity_type_id
  from public.entity_types
  where key = v_type_key
    and status = 'active';

  if v_entity_type_id is null then
    raise exception 'No se encontró el tipo de entidad solicitado' using errcode = '22023';
  end if;

  insert into public.ecclesiastical_entities (
    entity_type_id,
    name,
    official_name,
    slug,
    description,
    country_iso2,
    country,
    province,
    municipality,
    sector,
    address,
    email,
    phone,
    website,
    erected_at,
    territory_summary,
    source_name,
    source_url,
    source_checked_at,
    status,
    visibility,
    created_by
  ) values (
    v_entity_type_id,
    v_name,
    nullif(btrim(payload->>'official_name'), ''),
    v_slug,
    nullif(btrim(payload->>'description'), ''),
    v_country_iso2,
    v_country_name,
    nullif(btrim(payload->>'province'), ''),
    nullif(btrim(payload->>'municipality'), ''),
    nullif(btrim(payload->>'sector'), ''),
    nullif(btrim(payload->>'address'), ''),
    nullif(btrim(payload->>'email'), ''),
    nullif(btrim(payload->>'phone'), ''),
    nullif(btrim(payload->>'website'), ''),
    v_erected_at,
    nullif(btrim(payload->>'territory_summary'), ''),
    nullif(btrim(payload->>'source_name'), ''),
    nullif(btrim(payload->>'source_url'), ''),
    nullif(payload->>'source_checked_at', '')::date,
    'active',
    'public',
    v_user_id
  )
  returning id, slug into v_entity_id, v_slug;

  if v_parent_id is not null then
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
      'territorial',
      coalesce(v_erected_at, current_date),
      true,
      'active',
      case when v_type_key = 'parish'
        then 'Relación creada desde asistente transaccional de nueva parroquia.'
        else 'Relación creada desde asistente transaccional de nueva capilla.'
      end,
      v_user_id
    );
  end if;

  perform public.admin_mark_missing_fields(
    'ecclesiastical_entities',
    v_entity_id,
    payload->'not_identified_fields',
    array['official_name','address','phone','email','website','erected_at','territory_summary'],
    case when v_type_key = 'parish'
      then 'Marcado como no identificado desde el asistente transaccional de nueva parroquia.'
      else 'Marcado como no identificado desde el asistente transaccional de nueva capilla.'
    end,
    v_user_id
  );

  return jsonb_build_object(
    'entity_id', v_entity_id,
    'slug', v_slug,
    'entity_type_key', v_type_key,
    'country_iso2', v_country_iso2,
    'country', v_country_name
  );
end;
$$;
