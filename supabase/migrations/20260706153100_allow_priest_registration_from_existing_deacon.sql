create or replace function public.admin_save_priest(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_person_id uuid := nullif(payload->>'existing_deacon_person_id', '')::uuid;
  v_clergy_profile_id uuid;
  v_slug text;
  v_internal_code text;
  v_first_name text := nullif(btrim(payload->>'first_name'), '');
  v_last_name text := nullif(btrim(payload->>'last_name'), '');
  v_display_name text := nullif(btrim(payload->>'display_name'), '');
  v_office_configuration_id uuid := nullif(payload->>'quick_office_configuration_id', '')::uuid;
  v_assignment_entity_id uuid;
  v_organization_chart_id uuid;
  v_start_date date := nullif(payload->>'quick_start_date', '')::date;
  v_existing_type text;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar sacerdotes' using errcode = '42501';
  end if;

  if v_person_id is not null then
    select person_type, slug into v_existing_type, v_slug
    from public.persons
    where id = v_person_id
    for update;

    if v_existing_type is null then
      raise exception 'No se encontró el diácono seleccionado' using errcode = '22023';
    end if;

    if v_existing_type <> 'deacon' then
      raise exception 'La persona seleccionada no está registrada como diácono' using errcode = '22023';
    end if;

    update public.persons
    set person_type = 'priest',
        gender = coalesce(nullif(payload->>'gender', ''), gender),
        birth_date = coalesce(nullif(payload->>'birth_date', '')::date, birth_date),
        birth_place = coalesce(nullif(btrim(payload->>'birth_place'), ''), birth_place),
        photo_url = coalesce(nullif(btrim(payload->>'photo_url'), ''), photo_url),
        photo_path = coalesce(nullif(btrim(payload->>'photo_path'), ''), photo_path),
        biography_public = coalesce(nullif(btrim(payload->>'biography_public'), ''), biography_public),
        notes_internal = concat_ws(E'\n', notes_internal, nullif(btrim(payload->>'notes_internal'), '')),
        updated_at = now()
    where id = v_person_id;
  else
    v_display_name := coalesce(
      v_display_name,
      concat_ws(' ', v_first_name, nullif(btrim(payload->>'middle_name'), ''), v_last_name, nullif(btrim(payload->>'second_last_name'), ''))
    );
    v_slug := nullif(btrim(payload->>'slug'), '');
    v_slug := coalesce(v_slug, regexp_replace(lower(unaccent(v_display_name)), '[^a-z0-9]+', '-', 'g'));
    v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');

    if v_first_name is null or v_last_name is null or v_display_name is null or v_slug is null then
      raise exception 'Nombre, apellido y nombre para mostrar son obligatorios' using errcode = '22023';
    end if;

    insert into public.persons (
      first_name, middle_name, last_name, second_last_name, display_name, slug,
      person_type, gender, birth_date, birth_place, photo_url, photo_path,
      biography_public, notes_internal, status, visibility, created_by
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
      nullif(btrim(payload->>'photo_url'), ''),
      nullif(btrim(payload->>'photo_path'), ''),
      nullif(btrim(payload->>'biography_public'), ''),
      nullif(btrim(payload->>'notes_internal'), ''),
      'active',
      'public',
      v_user_id
    ) returning id, slug into v_person_id, v_slug;
  end if;

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
    public.generate_person_internal_code_for_type('priest'),
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
  )
  on conflict (person_id) do update set
    validation_type = coalesce(excluded.validation_type, public.person_private_validation.validation_type),
    validation_value = coalesce(excluded.validation_value, public.person_private_validation.validation_value),
    validation_country = coalesce(excluded.validation_country, public.person_private_validation.validation_country),
    primary_phone = coalesce(excluded.primary_phone, public.person_private_validation.primary_phone),
    secondary_phone = coalesce(excluded.secondary_phone, public.person_private_validation.secondary_phone),
    contact_email = coalesce(excluded.contact_email, public.person_private_validation.contact_email),
    father_name = coalesce(excluded.father_name, public.person_private_validation.father_name),
    mother_name = coalesce(excluded.mother_name, public.person_private_validation.mother_name),
    family_notes = coalesce(excluded.family_notes, public.person_private_validation.family_notes),
    biography_notes = coalesce(excluded.biography_notes, public.person_private_validation.biography_notes),
    updated_at = now()
  returning internal_reference_code into v_internal_code;

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
  on conflict (person_id) do update set
    incardination_entity_id = coalesce(excluded.incardination_entity_id, public.clergy_profiles.incardination_entity_id),
    current_service_entity_id = coalesce(excluded.current_service_entity_id, public.clergy_profiles.current_service_entity_id),
    diaconal_ordination_date = coalesce(excluded.diaconal_ordination_date, public.clergy_profiles.diaconal_ordination_date),
    priestly_ordination_date = coalesce(excluded.priestly_ordination_date, public.clergy_profiles.priestly_ordination_date),
    religious_order = coalesce(excluded.religious_order, public.clergy_profiles.religious_order),
    canonical_status = coalesce(excluded.canonical_status, public.clergy_profiles.canonical_status),
    notes_private = concat_ws(E'\n', public.clergy_profiles.notes_private, excluded.notes_private),
    updated_at = now()
  returning id into v_clergy_profile_id;

  if v_office_configuration_id is not null then
    v_assignment_entity_id := coalesce(
      nullif(payload->>'quick_entity_id', '')::uuid,
      nullif(payload->>'current_service_entity_id', '')::uuid
    );

    select organization_chart_id into v_organization_chart_id
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
      'Asignación creada desde asistente transaccional de sacerdote.',
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
    'Marcado como no identificado desde el asistente transaccional de sacerdote.',
    v_user_id
  );

  perform public.admin_mark_missing_fields(
    'clergy_profiles',
    v_clergy_profile_id,
    payload->'not_identified_fields',
    array['priestly_ordination_date','incardination_entity_id','current_service_entity_id'],
    'Marcado como no identificado desde el asistente transaccional de sacerdote.',
    v_user_id
  );

  return jsonb_build_object(
    'person_id', v_person_id,
    'clergy_profile_id', v_clergy_profile_id,
    'slug', v_slug,
    'internal_reference_code', v_internal_code
  );
end;
$$;

grant execute on function public.admin_save_priest(jsonb) to authenticated;
