alter table public.clergy_profiles
  add column if not exists deacon_type text,
  add column if not exists external_jurisdiction_name text,
  add column if not exists clerical_history_status text;

alter table public.clergy_profiles
  drop constraint if exists clergy_profiles_deacon_type_check;

alter table public.clergy_profiles
  add constraint clergy_profiles_deacon_type_check
  check (
    deacon_type is null
    or deacon_type in ('permanent', 'transitional', 'external')
  );

alter table public.clergy_profiles
  drop constraint if exists clergy_profiles_clerical_history_status_check;

alter table public.clergy_profiles
  add constraint clergy_profiles_clerical_history_status_check
  check (
    clerical_history_status is null
    or clerical_history_status in ('complete', 'pending', 'external')
  );

create or replace function public.admin_save_deacon(payload jsonb)
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
  v_internal_code text;
  v_first_name text := nullif(btrim(payload->>'first_name'), '');
  v_last_name text := nullif(btrim(payload->>'last_name'), '');
  v_display_name text := nullif(btrim(payload->>'display_name'), '');
  v_deacon_type text := coalesce(nullif(payload->>'deacon_type', ''), 'permanent');
  v_history_status text := 'complete';
  v_office_configuration_id uuid := nullif(payload->>'quick_office_configuration_id', '')::uuid;
  v_assignment_entity_id uuid;
  v_organization_chart_id uuid;
  v_start_date date := nullif(payload->>'quick_start_date', '')::date;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar diáconos' using errcode = '42501';
  end if;

  if v_deacon_type not in ('permanent', 'transitional', 'external') then
    raise exception 'Tipo de diácono inválido' using errcode = '22023';
  end if;

  if v_deacon_type = 'external' then
    v_history_status := 'external';
  end if;

  v_display_name := coalesce(
    v_display_name,
    concat_ws(' ', v_first_name, nullif(btrim(payload->>'middle_name'), ''), v_last_name, nullif(btrim(payload->>'second_last_name'), ''))
  );
  v_slug := nullif(btrim(payload->>'slug'), '');
  v_slug := coalesce(v_slug, regexp_replace(lower(unaccent(v_display_name)), '[^a-z0-9]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

  if v_first_name is null or v_last_name is null or v_display_name is null or v_slug is null then
    raise exception 'Primer nombre y primer apellido son obligatorios' using errcode = '22023';
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
    photo_url,
    photo_path,
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
    'deacon',
    coalesce(nullif(payload->>'gender', ''), 'male'),
    nullif(payload->>'birth_date', '')::date,
    nullif(btrim(payload->>'birth_place'), ''),
    nullif(btrim(payload->>'photo_url'), ''),
    nullif(btrim(payload->>'photo_path'), ''),
    nullif(btrim(payload->>'biography_public'), ''),
    nullif(btrim(payload->>'notes_internal'), ''),
    'active',
    'public',
    v_user_id
  )
  returning id, slug into v_person_id, v_slug;

  v_internal_code := public.generate_person_internal_code_for_type('deacon');

  insert into public.person_private_validation (
    person_id,
    internal_reference_code,
    validation_type,
    validation_value,
    validation_country,
    primary_phone,
    secondary_phone,
    contact_email,
    father_name,
    mother_name,
    family_notes,
    biography_notes,
    created_by
  ) values (
    v_person_id,
    v_internal_code,
    nullif(payload->>'validation_type', ''),
    nullif(btrim(payload->>'validation_value'), ''),
    nullif(btrim(payload->>'validation_country'), ''),
    nullif(btrim(payload->>'primary_phone'), ''),
    nullif(btrim(payload->>'secondary_phone'), ''),
    nullif(btrim(payload->>'contact_email'), ''),
    nullif(btrim(payload->>'father_name'), ''),
    nullif(btrim(payload->>'mother_name'), ''),
    nullif(btrim(payload->>'family_notes'), ''),
    nullif(btrim(payload->>'biography_notes'), ''),
    v_user_id
  );

  insert into public.clergy_profiles (
    person_id,
    incardination_entity_id,
    current_service_entity_id,
    diaconal_ordination_date,
    religious_order,
    canonical_status,
    notes_private,
    deacon_type,
    external_jurisdiction_name,
    clerical_history_status
  ) values (
    v_person_id,
    nullif(payload->>'incardination_entity_id', '')::uuid,
    nullif(payload->>'current_service_entity_id', '')::uuid,
    nullif(payload->>'diaconal_ordination_date', '')::date,
    nullif(btrim(payload->>'religious_order'), ''),
    coalesce(nullif(payload->>'canonical_status', ''), 'active'),
    nullif(btrim(payload->>'clergy_notes'), ''),
    v_deacon_type,
    nullif(btrim(payload->>'external_jurisdiction_name'), ''),
    v_history_status
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
      'Asignación creada desde asistente transaccional de nuevo diácono.',
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
    'Marcado como no identificado desde el asistente transaccional de nuevo diácono.',
    v_user_id
  );

  perform public.admin_mark_missing_fields(
    'clergy_profiles',
    v_clergy_profile_id,
    payload->'not_identified_fields',
    array['diaconal_ordination_date','incardination_entity_id','current_service_entity_id'],
    'Marcado como no identificado desde el asistente transaccional de nuevo diácono.',
    v_user_id
  );

  return jsonb_build_object(
    'person_id', v_person_id,
    'clergy_profile_id', v_clergy_profile_id,
    'slug', v_slug,
    'internal_reference_code', v_internal_code,
    'deacon_type', v_deacon_type
  );
end;
$$;

grant execute on function public.admin_save_deacon(jsonb) to authenticated;
