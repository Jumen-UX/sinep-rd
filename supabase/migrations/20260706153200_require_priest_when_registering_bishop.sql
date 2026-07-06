create or replace function public.admin_save_bishop(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_mode text := coalesce(payload->>'mode', 'existing');
  v_person_id uuid;
  v_slug text;
  v_name text;
  v_first_name text;
  v_last_name text;
  v_office_configuration_id uuid;
  v_assignment_entity_id uuid;
  v_organization_chart_id uuid;
  v_existing_type text;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar obispos' using errcode = '42501';
  end if;

  if v_mode = 'existing' then
    v_person_id := nullif(payload->>'selected_clergy_id', '')::uuid;

    if v_person_id is null then
      raise exception 'Falta seleccionar el sacerdote existente' using errcode = '22023';
    end if;

    select person_type, slug
    into v_existing_type, v_slug
    from public.persons
    where id = v_person_id
    for update;

    if v_existing_type is null then
      raise exception 'Sacerdote no encontrado' using errcode = '22023';
    end if;

    if v_existing_type <> 'priest' then
      raise exception 'Para registrar un obispo se debe seleccionar una persona registrada como sacerdote' using errcode = '22023';
    end if;

    update public.persons
    set person_type = 'bishop',
        updated_at = now()
    where id = v_person_id;
  else
    v_first_name := nullif(btrim(payload->>'first_name'), '');
    v_last_name := nullif(btrim(payload->>'last_name'), '');
    v_name := coalesce(nullif(btrim(payload->>'display_name'), ''), concat_ws(' ', v_first_name, nullif(btrim(payload->>'middle_name'), ''), v_last_name, nullif(btrim(payload->>'second_last_name'), '')));
    v_slug := nullif(btrim(payload->>'slug'), '');
    v_slug := coalesce(v_slug, regexp_replace(lower(unaccent(v_name)), '[^a-z0-9]+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

    if v_first_name is null or v_last_name is null or v_name is null or v_slug is null then
      raise exception 'Nombre y apellido son obligatorios para registrar un obispo externo' using errcode = '22023';
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
      v_name,
      v_slug,
      'bishop',
      'male',
      nullif(payload->>'birth_date', '')::date,
      nullif(btrim(payload->>'birth_place'), ''),
      nullif(btrim(payload->>'biography_public'), ''),
      'Obispo externo registrado sin ficha sacerdotal previa en SINEP RD. Historial sacerdotal pendiente de completar.',
      'active',
      'public',
      v_user_id
    )
    returning id, slug into v_person_id, v_slug;

    insert into public.person_private_validation (
      person_id,
      internal_reference_code,
      created_by,
      biography_notes
    ) values (
      v_person_id,
      public.generate_person_internal_code_for_type('bishop'),
      v_user_id,
      'Historial sacerdotal pendiente de completar.'
    )
    on conflict (person_id) do nothing;
  end if;

  insert into public.clergy_profiles (
    person_id,
    incardination_entity_id,
    current_service_entity_id,
    priestly_ordination_date,
    episcopal_ordination_date,
    religious_order,
    canonical_status,
    notes_private
  ) values (
    v_person_id,
    nullif(payload->>'incardination_entity_id', '')::uuid,
    nullif(payload->>'assignment_entity_id', '')::uuid,
    nullif(payload->>'priestly_ordination_date', '')::date,
    nullif(payload->>'episcopal_ordination_date', '')::date,
    nullif(btrim(payload->>'religious_order'), ''),
    'active',
    case when v_mode = 'existing' then 'Registrado como obispo desde sacerdote existente.' else 'Obispo externo: historial sacerdotal pendiente.' end
  )
  on conflict (person_id) do update set
    incardination_entity_id = coalesce(excluded.incardination_entity_id, public.clergy_profiles.incardination_entity_id),
    current_service_entity_id = coalesce(excluded.current_service_entity_id, public.clergy_profiles.current_service_entity_id),
    priestly_ordination_date = coalesce(excluded.priestly_ordination_date, public.clergy_profiles.priestly_ordination_date),
    episcopal_ordination_date = coalesce(excluded.episcopal_ordination_date, public.clergy_profiles.episcopal_ordination_date),
    religious_order = coalesce(excluded.religious_order, public.clergy_profiles.religious_order),
    canonical_status = excluded.canonical_status,
    notes_private = concat_ws(E'\n', public.clergy_profiles.notes_private, excluded.notes_private),
    updated_at = now();

  insert into public.episcopal_ordinations (
    bishop_person_id,
    ordination_date,
    ordination_place,
    principal_consecrator_person_id,
    co_consecrator_1_person_id,
    co_consecrator_2_person_id,
    principal_consecrator_name,
    co_consecrator_1_name,
    co_consecrator_2_name,
    source_name,
    source_url,
    source_checked_at,
    verification_status,
    visibility,
    status,
    notes_public,
    notes_internal,
    created_by
  ) values (
    v_person_id,
    nullif(payload->>'episcopal_ordination_date', '')::date,
    nullif(btrim(payload->>'ordination_place'), ''),
    nullif(payload->>'principal_consecrator_person_id', '')::uuid,
    nullif(payload->>'co_consecrator_1_person_id', '')::uuid,
    nullif(payload->>'co_consecrator_2_person_id', '')::uuid,
    nullif(btrim(payload->>'principal_consecrator_name'), ''),
    nullif(btrim(payload->>'co_consecrator_1_name'), ''),
    nullif(btrim(payload->>'co_consecrator_2_name'), ''),
    nullif(btrim(payload->>'source_name'), ''),
    nullif(btrim(payload->>'source_url'), ''),
    nullif(payload->>'source_checked_at', '')::date,
    'pending_review',
    'public',
    'active',
    nullif(btrim(payload->>'ordination_notes_public'), ''),
    'Guardado desde asistente transaccional de obispo.',
    v_user_id
  )
  on conflict (bishop_person_id) do update set
    ordination_date = coalesce(excluded.ordination_date, public.episcopal_ordinations.ordination_date),
    ordination_place = coalesce(excluded.ordination_place, public.episcopal_ordinations.ordination_place),
    principal_consecrator_person_id = coalesce(excluded.principal_consecrator_person_id, public.episcopal_ordinations.principal_consecrator_person_id),
    co_consecrator_1_person_id = coalesce(excluded.co_consecrator_1_person_id, public.episcopal_ordinations.co_consecrator_1_person_id),
    co_consecrator_2_person_id = coalesce(excluded.co_consecrator_2_person_id, public.episcopal_ordinations.co_consecrator_2_person_id),
    principal_consecrator_name = coalesce(excluded.principal_consecrator_name, public.episcopal_ordinations.principal_consecrator_name),
    co_consecrator_1_name = coalesce(excluded.co_consecrator_1_name, public.episcopal_ordinations.co_consecrator_1_name),
    co_consecrator_2_name = coalesce(excluded.co_consecrator_2_name, public.episcopal_ordinations.co_consecrator_2_name),
    source_name = coalesce(excluded.source_name, public.episcopal_ordinations.source_name),
    source_url = coalesce(excluded.source_url, public.episcopal_ordinations.source_url),
    source_checked_at = coalesce(excluded.source_checked_at, public.episcopal_ordinations.source_checked_at),
    notes_public = coalesce(excluded.notes_public, public.episcopal_ordinations.notes_public),
    status = 'active',
    visibility = 'public',
    updated_at = now();

  v_office_configuration_id := nullif(payload->>'office_configuration_id', '')::uuid;
  v_assignment_entity_id := nullif(payload->>'assignment_entity_id', '')::uuid;

  if v_office_configuration_id is not null then
    select organization_chart_id
    into v_organization_chart_id
    from public.office_configurations
    where id = v_office_configuration_id;

    update public.position_assignments
    set is_current = false,
        assignment_status = 'ended',
        actual_end_date = coalesce(nullif(payload->>'appointment_start_date', '')::date, current_date)
    where person_id = v_person_id
      and office_configuration_id = v_office_configuration_id
      and ecclesiastical_entity_id is not distinct from v_assignment_entity_id
      and is_current = true;

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
      nullif(btrim(payload->>'title_override'), ''),
      nullif(payload->>'appointment_start_date', '')::date,
      nullif(payload->>'appointment_start_date', '')::date,
      true,
      'active',
      'appointment',
      nullif(btrim(payload->>'appointment_notes_public'), ''),
      'Cargo episcopal creado desde asistente transaccional.',
      'pending_review',
      'public',
      'active'
    );
  end if;

  return jsonb_build_object('person_id', v_person_id, 'slug', v_slug);
end;
$$;

grant execute on function public.admin_save_bishop(jsonb) to authenticated;
