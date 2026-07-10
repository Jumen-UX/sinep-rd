create or replace function internal.admin_save_deacon(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, internal, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_mode text := coalesce(nullif(payload->>'mode', ''), 'new');
  v_selected_person_id uuid := nullif(payload->>'selected_person_id', '')::uuid;
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

  if v_mode not in ('existing', 'new') then
    raise exception 'Modo de registro inválido' using errcode = '22023';
  end if;

  if v_deacon_type not in ('permanent', 'transitional', 'external') then
    raise exception 'Tipo de diácono inválido' using errcode = '22023';
  end if;

  if v_deacon_type = 'external' then
    v_history_status := 'external';
  end if;

  if v_mode = 'existing' then
    if v_selected_person_id is null then
      raise exception 'Debes seleccionar la persona que recibió el diaconado' using errcode = '22023';
    end if;

    select p.id, p.slug, p.first_name, p.last_name, p.display_name
    into v_person_id, v_slug, v_first_name, v_last_name, v_display_name
    from public.persons p
    where p.id = v_selected_person_id
      and p.status = 'active'
      and not exists (
        select 1
        from public.ordination_events oe
        where oe.person_id = p.id
          and oe.record_status = 'active'
      )
    for update;

    if not found then
      raise exception 'La persona seleccionada no existe, está inactiva o ya tiene una ordenación registrada' using errcode = '22023';
    end if;
  else
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
      'layperson',
      coalesce(nullif(payload->>'gender', ''), 'male'),
      nullif(payload->>'birth_date', '')::date,
      nullif(btrim(payload->>'birth_place'), ''),
      nullif(btrim(payload->>'photo_url'), ''),
      nullif(btrim(payload->>'photo_path'), ''),
      nullif(btrim(payload->>'biography_public'), ''),
      nullif(btrim(payload->>'notes_internal'), ''),
      'active', 'public', v_user_id
    )
    returning id, slug into v_person_id, v_slug;
  end if;

  select ppv.internal_reference_code
  into v_internal_code
  from public.person_private_validation ppv
  where ppv.person_id = v_person_id;

  v_internal_code := coalesce(v_internal_code, public.generate_person_internal_code_for_type('deacon'));

  insert into public.person_private_validation (
    person_id, internal_reference_code, validation_type, validation_value,
    validation_country, primary_phone, secondary_phone, contact_email,
    father_name, mother_name, family_notes, biography_notes, created_by
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
  )
  on conflict (person_id) do update set
    internal_reference_code = coalesce(person_private_validation.internal_reference_code, excluded.internal_reference_code),
    validation_type = coalesce(excluded.validation_type, person_private_validation.validation_type),
    validation_value = coalesce(excluded.validation_value, person_private_validation.validation_value),
    validation_country = coalesce(excluded.validation_country, person_private_validation.validation_country),
    primary_phone = coalesce(excluded.primary_phone, person_private_validation.primary_phone),
    secondary_phone = coalesce(excluded.secondary_phone, person_private_validation.secondary_phone),
    contact_email = coalesce(excluded.contact_email, person_private_validation.contact_email),
    father_name = coalesce(excluded.father_name, person_private_validation.father_name),
    mother_name = coalesce(excluded.mother_name, person_private_validation.mother_name),
    family_notes = coalesce(excluded.family_notes, person_private_validation.family_notes),
    biography_notes = coalesce(excluded.biography_notes, person_private_validation.biography_notes)
  returning internal_reference_code into v_internal_code;

  insert into public.clergy_profiles (
    person_id, incardination_entity_id, current_service_entity_id,
    diaconal_ordination_date, religious_order, canonical_status,
    notes_private, deacon_type, external_jurisdiction_name, clerical_history_status
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
  on conflict (person_id) do update set
    incardination_entity_id = coalesce(excluded.incardination_entity_id, clergy_profiles.incardination_entity_id),
    current_service_entity_id = coalesce(excluded.current_service_entity_id, clergy_profiles.current_service_entity_id),
    diaconal_ordination_date = coalesce(excluded.diaconal_ordination_date, clergy_profiles.diaconal_ordination_date),
    religious_order = coalesce(excluded.religious_order, clergy_profiles.religious_order),
    canonical_status = excluded.canonical_status,
    notes_private = coalesce(excluded.notes_private, clergy_profiles.notes_private),
    deacon_type = excluded.deacon_type,
    external_jurisdiction_name = coalesce(excluded.external_jurisdiction_name, clergy_profiles.external_jurisdiction_name),
    clerical_history_status = excluded.clerical_history_status,
    updated_at = now()
  returning id into v_clergy_profile_id;

  insert into public.ordination_events (
    person_id, degree, ordination_date, record_origin, notes_internal, created_by
  ) values (
    v_person_id,
    'diaconate',
    nullif(payload->>'diaconal_ordination_date', '')::date,
    case when v_mode = 'existing' then 'existing_person_ordination' else 'deacon_wizard' end,
    'Ordenación diaconal registrada desde el asistente transaccional.',
    v_user_id
  )
  on conflict (person_id, degree) do update set
    ordination_date = coalesce(excluded.ordination_date, ordination_events.ordination_date),
    record_status = 'active',
    updated_at = now();

  if v_office_configuration_id is not null then
    v_assignment_entity_id := coalesce(
      nullif(payload->>'quick_entity_id', '')::uuid,
      nullif(payload->>'current_service_entity_id', '')::uuid
    );

    select organization_chart_id into v_organization_chart_id
    from public.office_configurations
    where id = v_office_configuration_id;

    insert into public.position_assignments (
      person_id, office_configuration_id, organization_chart_id,
      ecclesiastical_entity_id, title_override, start_date, term_start_date,
      is_current, assignment_status, selection_method, notes_public,
      notes_internal, verification_status, visibility, record_status
    ) values (
      v_person_id, v_office_configuration_id, v_organization_chart_id,
      v_assignment_entity_id, nullif(btrim(payload->>'quick_title_override'), ''),
      v_start_date, v_start_date, true, 'active', 'appointment',
      nullif(btrim(payload->>'quick_notes_public'), ''),
      'Asignación creada desde asistente transaccional de diácono.',
      'pending_review', 'public', 'active'
    );
  end if;

  perform public.admin_mark_missing_fields(
    'persons', v_person_id, payload->'not_identified_fields',
    array['gender','birth_date','birth_place','biography_public'],
    'Marcado como no identificado desde el asistente transaccional de diácono.', v_user_id
  );

  perform public.admin_mark_missing_fields(
    'clergy_profiles', v_clergy_profile_id, payload->'not_identified_fields',
    array['diaconal_ordination_date','incardination_entity_id','current_service_entity_id'],
    'Marcado como no identificado desde el asistente transaccional de diácono.', v_user_id
  );

  return jsonb_build_object(
    'person_id', v_person_id,
    'clergy_profile_id', v_clergy_profile_id,
    'slug', v_slug,
    'internal_reference_code', v_internal_code,
    'deacon_type', v_deacon_type,
    'mode', v_mode
  );
end;
$$;
