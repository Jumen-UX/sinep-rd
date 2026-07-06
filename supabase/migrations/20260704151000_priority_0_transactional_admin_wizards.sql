-- Priority 0 follow-up: transactional admin wizards for priest, parish and chapel.
-- This migration was applied to project hrvgpceqaxujlttpimdz on 2026-07-04.

create or replace function public.admin_mark_missing_fields(
  p_record_table text,
  p_record_id uuid,
  p_fields jsonb,
  p_allowed_fields text[],
  p_notes text,
  p_created_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_field text;
begin
  if p_fields is null or jsonb_typeof(p_fields) <> 'array' then
    return;
  end if;

  for v_field in select jsonb_array_elements_text(p_fields)
  loop
    if v_field = any(p_allowed_fields) then
      insert into public.data_field_statuses (
        record_table,
        record_id,
        field_name,
        status,
        notes,
        created_by
      ) values (
        p_record_table,
        p_record_id,
        v_field,
        'unknown',
        p_notes,
        p_created_by
      )
      on conflict (record_table, record_id, field_name) do update set
        status = excluded.status,
        notes = excluded.notes,
        created_by = excluded.created_by,
        updated_at = now();
    end if;
  end loop;
end;
$$;

grant execute on function public.admin_mark_missing_fields(text, uuid, jsonb, text[], text, uuid) to authenticated;

create or replace function public.admin_save_priest(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_person_id uuid;
  v_clergy_profile_id uuid;
  v_slug text;
  v_first_name text := nullif(btrim(payload->>'first_name'), '');
  v_last_name text := nullif(btrim(payload->>'last_name'), '');
  v_display_name text := nullif(btrim(payload->>'display_name'), '');
  v_office_configuration_id uuid := nullif(payload->>'quick_office_configuration_id', '')::uuid;
  v_assignment_entity_id uuid;
  v_organization_chart_id uuid;
  v_start_date date := nullif(payload->>'quick_start_date', '')::date;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar sacerdotes' using errcode = '42501';
  end if;

  v_display_name := coalesce(
    v_display_name,
    concat_ws(' ', v_first_name, nullif(btrim(payload->>'middle_name'), ''), v_last_name, nullif(btrim(payload->>'second_last_name'), ''))
  );
  v_slug := nullif(btrim(payload->>'slug'), '');

  if v_first_name is null or v_last_name is null or v_display_name is null or v_slug is null then
    raise exception 'Nombre, apellido, nombre público y slug son obligatorios' using errcode = '22023';
  end if;

  insert into public.persons (
    first_name,
    middle_name,
    last_name,
    second_last_name,
    display_name,
    slug,
    person_type,
    gender,
    birth_date,
    birth_place,
    biography_public,
    notes_internal,
    status,
    visibility,
    created_by
  ) values (
    v_first_name,
    nullif(btrim(payload->>'middle_name'), ''),
    v_last_name,
    nullif(btrim(payload->>'second_last_name'), ''),
    v_display_name,
    v_slug,
    'priest',
    nullif(payload->>'gender', ''),
    nullif(payload->>'birth_date', '')::date,
    nullif(btrim(payload->>'birth_place'), ''),
    nullif(btrim(payload->>'biography_public'), ''),
    nullif(btrim(payload->>'notes_internal'), ''),
    'active',
    'public',
    v_user_id
  )
  returning id, slug into v_person_id, v_slug;

  insert into public.clergy_profiles (
    person_id,
    incardination_entity_id,
    current_service_entity_id,
    diaconal_ordination_date,
    priestly_ordination_date,
    religious_order,
    canonical_status,
    notes_private
  ) values (
    v_person_id,
    nullif(payload->>'incardination_entity_id', '')::uuid,
    nullif(payload->>'current_service_entity_id', '')::uuid,
    nullif(payload->>'diaconal_ordination_date', '')::date,
    nullif(payload->>'priestly_ordination_date', '')::date,
    nullif(btrim(payload->>'religious_order'), ''),
    coalesce(nullif(payload->>'canonical_status', ''), 'active'),
    nullif(btrim(payload->>'clergy_notes'), '')
  )
  returning id into v_clergy_profile_id;

  if v_office_configuration_id is not null then
    v_assignment_entity_id := coalesce(
      nullif(payload->>'quick_entity_id', '')::uuid,
      nullif(payload->>'current_service_entity_id', '')::uuid
    );

    select organization_chart_id
    into v_organization_chart_id
    from public.office_configurations
    where id = v_office_configuration_id;

    insert into public.position_assignments (
      person_id,
      office_configuration_id,
      organization_chart_id,
      ecclesiastical_entity_id,
      title_override,
      start_date,
      term_start_date,
      is_current,
      assignment_status,
      selection_method,
      notes_public,
      notes_internal,
      verification_status,
      visibility,
      record_status
    ) values (
      v_person_id,
      v_office_configuration_id,
      v_organization_chart_id,
      v_assignment_entity_id,
      nullif(btrim(payload->>'quick_title_override'), ''),
      v_start_date,
      v_start_date,
      true,
      'active',
      'appointment',
      nullif(btrim(payload->>'quick_notes_public'), ''),
      'Asignación creada desde asistente transaccional de nuevo sacerdote.',
      'pending_review',
      'public',
      'active'
    );
  end if;

  perform public.admin_mark_missing_fields(
    'persons',
    v_person_id,
    payload->'not_identified_fields',
    array['gender','birth_date','birth_place','biography_public'],
    'Marcado como no identificado desde el asistente transaccional de nuevo sacerdote.',
    v_user_id
  );

  perform public.admin_mark_missing_fields(
    'clergy_profiles',
    v_clergy_profile_id,
    payload->'not_identified_fields',
    array['priestly_ordination_date','incardination_entity_id','current_service_entity_id'],
    'Marcado como no identificado desde el asistente transaccional de nuevo sacerdote.',
    v_user_id
  );

  return jsonb_build_object('person_id', v_person_id, 'clergy_profile_id', v_clergy_profile_id, 'slug', v_slug);
end;
$$;

grant execute on function public.admin_save_priest(jsonb) to authenticated;

create or replace function public.admin_save_ecclesiastical_entity(payload jsonb)
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
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar entidades' using errcode = '42501';
  end if;

  if v_type_key not in ('parish', 'chapel') then
    raise exception 'Tipo de entidad no permitido para este asistente' using errcode = '22023';
  end if;

  if v_name is null or v_slug is null then
    raise exception 'Nombre y slug son obligatorios' using errcode = '22023';
  end if;

  select id
  into v_entity_type_id
  from public.entity_types
  where key = v_type_key;

  if v_entity_type_id is null then
    raise exception 'No se encontró el tipo de entidad solicitado' using errcode = '22023';
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
    coalesce(nullif(btrim(payload->>'country'), ''), 'República Dominicana'),
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

  return jsonb_build_object('entity_id', v_entity_id, 'slug', v_slug, 'entity_type_key', v_type_key);
end;
$$;

grant execute on function public.admin_save_ecclesiastical_entity(jsonb) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'data_field_statuses'
      and policyname = 'data_field_statuses_admin_all'
  ) then
    create policy data_field_statuses_admin_all
    on public.data_field_statuses
    for all
    to authenticated
    using ((select public.current_user_has_admin_role()))
    with check ((select public.current_user_has_admin_role()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'entity_relationships'
      and policyname = 'entity_relationships_admin_all'
  ) then
    create policy entity_relationships_admin_all
    on public.entity_relationships
    for all
    to authenticated
    using ((select public.current_user_has_admin_role()))
    with check ((select public.current_user_has_admin_role()));
  end if;
end $$;
