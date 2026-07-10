create or replace function internal.admin_save_canonical_person(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_flow text := lower(coalesce(nullif(payload->>'flow', ''), 'layperson'));
  v_selected_person_id uuid := coalesce(
    nullif(payload->>'selected_person_id', '')::uuid,
    nullif(payload->>'existing_deacon_person_id', '')::uuid,
    nullif(payload->>'selected_clergy_id', '')::uuid
  );
  v_mode text := lower(coalesce(
    nullif(payload->>'mode', ''),
    case when v_selected_person_id is null then 'new' else 'existing' end
  ));
  v_person_id uuid;
  v_clergy_profile_id uuid;
  v_religious_profile_id uuid;
  v_assignment_id uuid;
  v_episcopal_role_id uuid;
  v_slug text;
  v_slug_base text;
  v_slug_suffix integer := 2;
  v_internal_code text;
  v_first_name text;
  v_middle_name text;
  v_last_name text;
  v_second_last_name text;
  v_display_name text;
  v_target_entity_id uuid := coalesce(
    nullif(payload->>'quick_entity_id', '')::uuid,
    nullif(payload->>'assignment_entity_id', '')::uuid,
    nullif(payload->>'jurisdiction_entity_id', '')::uuid,
    nullif(payload->>'current_service_entity_id', '')::uuid,
    nullif(payload->>'incardination_entity_id', '')::uuid,
    nullif(payload->>'religious_house_entity_id', '')::uuid
  );
  v_office_configuration_id uuid := coalesce(
    nullif(payload->>'quick_office_configuration_id', '')::uuid,
    nullif(payload->>'office_configuration_id', '')::uuid
  );
  v_has_assignment boolean := v_office_configuration_id is not null;
  v_assignment_result jsonb := '{}'::jsonb;
  v_assignment_start_date date := coalesce(
    nullif(payload->>'quick_start_date', '')::date,
    nullif(payload->>'appointment_start_date', '')::date
  );
  v_assignment_visibility text;
  v_deacon_type text := coalesce(nullif(payload->>'deacon_type', ''), 'permanent');
  v_priest_type text := coalesce(
    nullif(payload->>'priest_type', ''),
    case when coalesce(
      nullif(btrim(payload->>'religious_institute_name'), ''),
      nullif(btrim(payload->>'religious_order'), ''),
      nullif(btrim(payload->>'community_name'), '')
    ) is not null then 'religious' else 'diocesan' end
  );
  v_religious_name text := coalesce(
    nullif(btrim(payload->>'religious_institute_name'), ''),
    nullif(btrim(payload->>'religious_order'), ''),
    nullif(btrim(payload->>'community_name'), '')
  );
  v_religious_life_type text := coalesce(nullif(payload->>'religious_life_type', ''), 'other');
  v_religious_status text := coalesce(nullif(payload->>'religious_canonical_status', ''), nullif(payload->>'canonical_status', ''), 'active');
  v_clerical_status text := coalesce(nullif(payload->>'clerical_status', ''), nullif(payload->>'canonical_status', ''), 'active');
  v_incardination_entity_id uuid := nullif(payload->>'incardination_entity_id', '')::uuid;
  v_incardination_kind text;
  v_incardination_method text;
  v_incardination_start date;
  v_role_type text := nullif(payload->>'episcopal_role_type', '');
  v_role_entity_id uuid := coalesce(
    nullif(payload->>'jurisdiction_entity_id', '')::uuid,
    nullif(payload->>'assignment_entity_id', '')::uuid
  );
  v_dignity text;
  v_has_diaconate boolean;
  v_has_presbyterate boolean;
  v_has_episcopate boolean;
  v_effective_person_type text;
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if not public.current_user_has_permission('people.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para registrar personas' using errcode = '42501';
  end if;

  if v_flow not in ('layperson', 'religious', 'deacon', 'priest', 'bishop') then
    raise exception 'Flujo de registro canónico inválido' using errcode = '22023';
  end if;

  if v_mode not in ('existing', 'new') then
    raise exception 'Modo de registro inválido' using errcode = '22023';
  end if;

  if v_mode = 'existing' and v_selected_person_id is null then
    raise exception 'Debes seleccionar una persona existente' using errcode = '22023';
  end if;

  if v_mode = 'existing' then
    if not app_private.current_user_can_manage_person('people.create_proposal', v_selected_person_id) then
      raise exception 'La persona seleccionada está fuera de tu alcance' using errcode = '42501';
    end if;

    select
      p.id, p.first_name, p.middle_name, p.last_name, p.second_last_name,
      p.display_name, p.slug
    into
      v_person_id, v_first_name, v_middle_name, v_last_name, v_second_last_name,
      v_display_name, v_slug
    from public.persons p
    where p.id = v_selected_person_id
      and p.status = 'active'
    for update;

    if not found then
      raise exception 'La persona seleccionada no existe o no está activa' using errcode = '22023';
    end if;

    select
      exists(select 1 from public.ordination_events oe where oe.person_id = v_person_id and oe.degree = 'diaconate' and oe.record_status = 'active'),
      exists(select 1 from public.ordination_events oe where oe.person_id = v_person_id and oe.degree = 'presbyterate' and oe.record_status = 'active'),
      exists(select 1 from public.ordination_events oe where oe.person_id = v_person_id and oe.degree = 'episcopate' and oe.record_status = 'active')
    into v_has_diaconate, v_has_presbyterate, v_has_episcopate;

    if v_flow = 'layperson' and (v_has_diaconate or v_has_presbyterate or v_has_episcopate) then
      raise exception 'La persona seleccionada ya posee una ordenación; gestiona su servicio desde nombramientos' using errcode = '22023';
    elsif v_flow = 'deacon' and (v_has_diaconate or v_has_presbyterate or v_has_episcopate) then
      raise exception 'La persona seleccionada ya posee una ordenación registrada' using errcode = '22023';
    elsif v_flow = 'priest' and (not v_has_diaconate or v_has_presbyterate or v_has_episcopate) then
      raise exception 'La persona seleccionada debe tener diaconado y no poseer todavía presbiterado' using errcode = '22023';
    elsif v_flow = 'bishop' and (not v_has_presbyterate or v_has_episcopate) then
      raise exception 'La persona seleccionada debe tener presbiterado y no poseer todavía episcopado' using errcode = '22023';
    end if;

    update public.persons
    set first_name = coalesce(nullif(btrim(payload->>'first_name'), ''), first_name),
        middle_name = coalesce(nullif(btrim(payload->>'middle_name'), ''), middle_name),
        last_name = coalesce(nullif(btrim(payload->>'last_name'), ''), last_name),
        second_last_name = coalesce(nullif(btrim(payload->>'second_last_name'), ''), second_last_name),
        display_name = coalesce(nullif(btrim(payload->>'display_name'), ''), display_name),
        gender = coalesce(nullif(payload->>'gender', ''), gender),
        birth_date = coalesce(nullif(payload->>'birth_date', '')::date, birth_date),
        birth_place = coalesce(nullif(btrim(payload->>'birth_place'), ''), birth_place),
        photo_url = coalesce(nullif(btrim(payload->>'photo_url'), ''), photo_url),
        photo_path = coalesce(nullif(btrim(payload->>'photo_path'), ''), photo_path),
        biography_public = coalesce(nullif(btrim(payload->>'biography_public'), ''), biography_public),
        notes_internal = concat_ws(E'\n', notes_internal, nullif(btrim(payload->>'notes_internal'), '')),
        updated_at = now()
    where id = v_person_id
    returning first_name, middle_name, last_name, second_last_name, display_name, slug
    into v_first_name, v_middle_name, v_last_name, v_second_last_name, v_display_name, v_slug;
  else
    v_first_name := nullif(btrim(payload->>'first_name'), '');
    v_middle_name := nullif(btrim(payload->>'middle_name'), '');
    v_last_name := nullif(btrim(payload->>'last_name'), '');
    v_second_last_name := nullif(btrim(payload->>'second_last_name'), '');
    v_display_name := coalesce(
      nullif(btrim(payload->>'display_name'), ''),
      nullif(btrim(concat_ws(' ', v_first_name, v_middle_name, v_last_name, v_second_last_name)), '')
    );

    if v_first_name is null or v_last_name is null or v_display_name is null then
      raise exception 'Primer nombre y primer apellido son obligatorios' using errcode = '22023';
    end if;

    v_slug_base := coalesce(
      nullif(btrim(payload->>'slug'), ''),
      regexp_replace(lower(unaccent(v_display_name)), '[^a-z0-9]+', '-', 'g')
    );
    v_slug_base := regexp_replace(v_slug_base, '(^-+|-+$)', '', 'g');
    if v_slug_base is null or v_slug_base = '' then
      raise exception 'No se pudo generar un identificador público para la persona' using errcode = '22023';
    end if;

    v_slug := v_slug_base;
    while exists(select 1 from public.persons p where p.slug = v_slug) loop
      v_slug := v_slug_base || '-' || v_slug_suffix::text;
      v_slug_suffix := v_slug_suffix + 1;
    end loop;

    insert into public.persons (
      first_name, middle_name, last_name, second_last_name, display_name, slug,
      person_type, gender, birth_date, birth_place, photo_url, photo_path,
      biography_public, notes_internal, status, visibility, created_by
    ) values (
      v_first_name, v_middle_name, v_last_name, v_second_last_name, v_display_name, v_slug,
      'layperson', nullif(payload->>'gender', ''), nullif(payload->>'birth_date', '')::date,
      nullif(btrim(payload->>'birth_place'), ''), nullif(btrim(payload->>'photo_url'), ''),
      nullif(btrim(payload->>'photo_path'), ''), nullif(btrim(payload->>'biography_public'), ''),
      nullif(btrim(payload->>'notes_internal'), ''), 'active',
      coalesce(nullif(payload->>'visibility', ''), 'public'), v_user_id
    ) returning id into v_person_id;
  end if;

  if v_target_entity_id is null and v_mode = 'new' and not public.current_user_is_super_or_national() then
    raise exception 'Debes indicar una entidad dentro de tu alcance' using errcode = '42501';
  end if;

  if v_target_entity_id is not null
     and not app_private.current_user_can_manage_entity('people.create_proposal', v_target_entity_id) then
    raise exception 'La entidad seleccionada está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_has_assignment then
    if not public.current_user_has_permission('appointments.create_proposal')
       and not public.current_user_is_super_or_national() then
      raise exception 'No autorizado para crear el nombramiento' using errcode = '42501';
    end if;

    if v_target_entity_id is null
       or not app_private.current_user_can_manage_entity('appointments.create_proposal', v_target_entity_id) then
      raise exception 'La entidad del nombramiento está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  select ppv.internal_reference_code
  into v_internal_code
  from public.person_private_validation ppv
  where ppv.person_id = v_person_id;

  v_internal_code := coalesce(
    v_internal_code,
    public.generate_person_internal_code_for_type(
      case v_flow
        when 'bishop' then 'bishop'
        when 'priest' then 'priest'
        when 'deacon' then 'deacon'
        when 'religious' then 'religious'
        else 'layperson'
      end
    )
  );

  insert into public.person_private_validation (
    person_id, internal_reference_code, validation_type, validation_value,
    validation_country, primary_phone, secondary_phone, contact_email,
    father_name, mother_name, family_notes, biography_notes, created_by
  ) values (
    v_person_id, v_internal_code, nullif(payload->>'validation_type', ''),
    nullif(btrim(payload->>'validation_value'), ''), nullif(btrim(payload->>'validation_country'), ''),
    nullif(btrim(payload->>'primary_phone'), ''), nullif(btrim(payload->>'secondary_phone'), ''),
    nullif(btrim(payload->>'contact_email'), ''), nullif(btrim(payload->>'father_name'), ''),
    nullif(btrim(payload->>'mother_name'), ''), nullif(btrim(payload->>'family_notes'), ''),
    nullif(btrim(payload->>'biography_notes'), ''), v_user_id
  )
  on conflict (person_id) do update set
    internal_reference_code = coalesce(public.person_private_validation.internal_reference_code, excluded.internal_reference_code),
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

  if v_flow in ('deacon', 'priest', 'bishop') then
    if v_deacon_type not in ('permanent', 'transitional', 'external') then
      raise exception 'Tipo de diácono inválido' using errcode = '22023';
    end if;
    if v_priest_type not in ('diocesan', 'religious') then
      raise exception 'Tipo de sacerdote inválido' using errcode = '22023';
    end if;
    if v_priest_type = 'religious' and v_religious_name is null then
      raise exception 'Debes indicar el instituto, congregación u orden' using errcode = '22023';
    end if;

    insert into public.ordination_events (
      person_id, degree, ordination_date, ordination_place,
      principal_ordainer_person_id, principal_ordainer_name,
      source_name, source_url, source_checked_at,
      verification_status, visibility, record_status, record_origin,
      notes_public, notes_internal, created_by
    ) values (
      v_person_id, 'diaconate', nullif(payload->>'diaconal_ordination_date', '')::date,
      nullif(btrim(payload->>'diaconal_ordination_place'), ''),
      nullif(payload->>'diaconal_principal_ordainer_person_id', '')::uuid,
      nullif(btrim(payload->>'diaconal_principal_ordainer_name'), ''),
      nullif(btrim(payload->>'source_name'), ''), nullif(btrim(payload->>'source_url'), ''),
      nullif(payload->>'source_checked_at', '')::date,
      coalesce(nullif(payload->>'verification_status', ''), 'pending_review'),
      coalesce(nullif(payload->>'ordination_visibility', ''), 'public'),
      'active', 'canonical_registration_engine',
      nullif(btrim(payload->>'diaconal_notes_public'), ''),
      'Diaconado registrado por el motor canónico común.', v_user_id
    )
    on conflict (person_id, degree) do update set
      ordination_date = coalesce(excluded.ordination_date, public.ordination_events.ordination_date),
      ordination_place = coalesce(excluded.ordination_place, public.ordination_events.ordination_place),
      principal_ordainer_person_id = coalesce(excluded.principal_ordainer_person_id, public.ordination_events.principal_ordainer_person_id),
      principal_ordainer_name = coalesce(excluded.principal_ordainer_name, public.ordination_events.principal_ordainer_name),
      source_name = coalesce(excluded.source_name, public.ordination_events.source_name),
      source_url = coalesce(excluded.source_url, public.ordination_events.source_url),
      source_checked_at = coalesce(excluded.source_checked_at, public.ordination_events.source_checked_at),
      record_status = 'active', updated_at = now();

    if v_flow in ('priest', 'bishop') then
      insert into public.ordination_events (
        person_id, degree, ordination_date, ordination_place,
        principal_ordainer_person_id, principal_ordainer_name,
        source_name, source_url, source_checked_at,
        verification_status, visibility, record_status, record_origin,
        notes_public, notes_internal, created_by
      ) values (
        v_person_id, 'presbyterate', nullif(payload->>'priestly_ordination_date', '')::date,
        nullif(btrim(payload->>'priestly_ordination_place'), ''),
        nullif(payload->>'priestly_principal_ordainer_person_id', '')::uuid,
        nullif(btrim(payload->>'priestly_principal_ordainer_name'), ''),
        nullif(btrim(payload->>'source_name'), ''), nullif(btrim(payload->>'source_url'), ''),
        nullif(payload->>'source_checked_at', '')::date,
        coalesce(nullif(payload->>'verification_status', ''), 'pending_review'),
        coalesce(nullif(payload->>'ordination_visibility', ''), 'public'),
        'active', 'canonical_registration_engine',
        nullif(btrim(payload->>'priestly_notes_public'), ''),
        'Presbiterado registrado por el motor canónico común.', v_user_id
      )
      on conflict (person_id, degree) do update set
        ordination_date = coalesce(excluded.ordination_date, public.ordination_events.ordination_date),
        ordination_place = coalesce(excluded.ordination_place, public.ordination_events.ordination_place),
        principal_ordainer_person_id = coalesce(excluded.principal_ordainer_person_id, public.ordination_events.principal_ordainer_person_id),
        principal_ordainer_name = coalesce(excluded.principal_ordainer_name, public.ordination_events.principal_ordainer_name),
        source_name = coalesce(excluded.source_name, public.ordination_events.source_name),
        source_url = coalesce(excluded.source_url, public.ordination_events.source_url),
        source_checked_at = coalesce(excluded.source_checked_at, public.ordination_events.source_checked_at),
        record_status = 'active', updated_at = now();
    end if;

    if v_flow = 'bishop' then
      insert into public.ordination_events (
        person_id, degree, ordination_date, ordination_place,
        principal_ordainer_person_id, principal_ordainer_name,
        assistant_ordainer_1_person_id, assistant_ordainer_1_name,
        assistant_ordainer_2_person_id, assistant_ordainer_2_name,
        source_name, source_url, source_checked_at,
        verification_status, visibility, record_status, record_origin,
        notes_public, notes_internal, created_by
      ) values (
        v_person_id, 'episcopate', nullif(payload->>'episcopal_ordination_date', '')::date,
        coalesce(nullif(btrim(payload->>'episcopal_ordination_place'), ''), nullif(btrim(payload->>'ordination_place'), '')),
        nullif(payload->>'principal_consecrator_person_id', '')::uuid,
        nullif(btrim(payload->>'principal_consecrator_name'), ''),
        nullif(payload->>'co_consecrator_1_person_id', '')::uuid,
        nullif(btrim(payload->>'co_consecrator_1_name'), ''),
        nullif(payload->>'co_consecrator_2_person_id', '')::uuid,
        nullif(btrim(payload->>'co_consecrator_2_name'), ''),
        nullif(btrim(payload->>'source_name'), ''), nullif(btrim(payload->>'source_url'), ''),
        nullif(payload->>'source_checked_at', '')::date,
        coalesce(nullif(payload->>'verification_status', ''), 'pending_review'),
        coalesce(nullif(payload->>'ordination_visibility', ''), 'public'),
        'active', 'canonical_registration_engine',
        nullif(btrim(payload->>'ordination_notes_public'), ''),
        'Episcopado registrado por el motor canónico común.', v_user_id
      )
      on conflict (person_id, degree) do update set
        ordination_date = coalesce(excluded.ordination_date, public.ordination_events.ordination_date),
        ordination_place = coalesce(excluded.ordination_place, public.ordination_events.ordination_place),
        principal_ordainer_person_id = coalesce(excluded.principal_ordainer_person_id, public.ordination_events.principal_ordainer_person_id),
        principal_ordainer_name = coalesce(excluded.principal_ordainer_name, public.ordination_events.principal_ordainer_name),
        assistant_ordainer_1_person_id = coalesce(excluded.assistant_ordainer_1_person_id, public.ordination_events.assistant_ordainer_1_person_id),
        assistant_ordainer_1_name = coalesce(excluded.assistant_ordainer_1_name, public.ordination_events.assistant_ordainer_1_name),
        assistant_ordainer_2_person_id = coalesce(excluded.assistant_ordainer_2_person_id, public.ordination_events.assistant_ordainer_2_person_id),
        assistant_ordainer_2_name = coalesce(excluded.assistant_ordainer_2_name, public.ordination_events.assistant_ordainer_2_name),
        source_name = coalesce(excluded.source_name, public.ordination_events.source_name),
        source_url = coalesce(excluded.source_url, public.ordination_events.source_url),
        source_checked_at = coalesce(excluded.source_checked_at, public.ordination_events.source_checked_at),
        record_status = 'active', updated_at = now();
    end if;

    insert into public.clergy_profiles (
      person_id, current_service_entity_id, diaconal_ordination_date,
      priestly_ordination_date, episcopal_ordination_date, canonical_status,
      notes_private, deacon_type, external_jurisdiction_name, clerical_history_status,
      priest_type, religious_order, religious_institute_name,
      religious_province_name, religious_house_entity_id
    ) values (
      v_person_id, nullif(payload->>'current_service_entity_id', '')::uuid,
      nullif(payload->>'diaconal_ordination_date', '')::date,
      nullif(payload->>'priestly_ordination_date', '')::date,
      nullif(payload->>'episcopal_ordination_date', '')::date,
      'active', nullif(btrim(payload->>'clergy_notes'), ''),
      case when v_flow = 'deacon' then v_deacon_type else null end,
      nullif(btrim(payload->>'external_jurisdiction_name'), ''),
      case when v_deacon_type = 'external' then 'external' else 'complete' end,
      case when v_flow in ('priest', 'bishop') then v_priest_type else null end,
      v_religious_name, v_religious_name,
      nullif(btrim(payload->>'religious_province_name'), ''),
      nullif(payload->>'religious_house_entity_id', '')::uuid
    )
    on conflict (person_id) do update set
      current_service_entity_id = coalesce(excluded.current_service_entity_id, public.clergy_profiles.current_service_entity_id),
      diaconal_ordination_date = coalesce(excluded.diaconal_ordination_date, public.clergy_profiles.diaconal_ordination_date),
      priestly_ordination_date = coalesce(excluded.priestly_ordination_date, public.clergy_profiles.priestly_ordination_date),
      episcopal_ordination_date = coalesce(excluded.episcopal_ordination_date, public.clergy_profiles.episcopal_ordination_date),
      notes_private = concat_ws(E'\n', public.clergy_profiles.notes_private, excluded.notes_private),
      deacon_type = coalesce(excluded.deacon_type, public.clergy_profiles.deacon_type),
      external_jurisdiction_name = coalesce(excluded.external_jurisdiction_name, public.clergy_profiles.external_jurisdiction_name),
      clerical_history_status = coalesce(excluded.clerical_history_status, public.clergy_profiles.clerical_history_status),
      priest_type = coalesce(excluded.priest_type, public.clergy_profiles.priest_type),
      religious_order = coalesce(excluded.religious_order, public.clergy_profiles.religious_order),
      religious_institute_name = coalesce(excluded.religious_institute_name, public.clergy_profiles.religious_institute_name),
      religious_province_name = coalesce(excluded.religious_province_name, public.clergy_profiles.religious_province_name),
      religious_house_entity_id = coalesce(excluded.religious_house_entity_id, public.clergy_profiles.religious_house_entity_id),
      updated_at = now()
    returning id into v_clergy_profile_id;

    if v_clerical_status not in ('active','retired','emeritus','suspended','restricted','inactive','deceased','lost_clerical_state','unknown') then
      raise exception 'Estado canónico clerical inválido' using errcode = '22023';
    end if;

    if not exists (
      select 1 from public.clerical_status_history csh
      where csh.person_id = v_person_id and csh.status_type = v_clerical_status
        and csh.is_current = true and csh.record_status = 'active'
    ) then
      insert into public.clerical_status_history (
        person_id, status_type, start_date, is_current, reason,
        source_name, source_url, source_checked_at, verification_status,
        visibility, record_status, record_origin, notes_internal, created_by
      ) values (
        v_person_id, v_clerical_status,
        coalesce(nullif(payload->>'canonical_status_start_date', '')::date, v_assignment_start_date),
        true, nullif(btrim(payload->>'canonical_status_reason'), ''),
        nullif(btrim(payload->>'source_name'), ''), nullif(btrim(payload->>'source_url'), ''),
        nullif(payload->>'source_checked_at', '')::date,
        coalesce(nullif(payload->>'verification_status', ''), 'pending_review'),
        'internal', 'active', 'canonical_registration_engine',
        'Estado clerical registrado por el motor canónico común.', v_user_id
      );
    end if;

    v_incardination_kind := coalesce(
      nullif(payload->>'incardination_kind', ''),
      case when v_priest_type = 'religious' then 'religious_institute' else 'diocesan' end
    );
    v_incardination_method := coalesce(
      nullif(payload->>'incardination_acquisition_method', ''),
      case when v_mode = 'new' then 'ordination' else 'incardination' end
    );
    v_incardination_start := coalesce(
      nullif(payload->>'incardination_start_date', '')::date,
      nullif(payload->>'diaconal_ordination_date', '')::date
    );

    if v_incardination_kind not in ('diocesan','religious_institute','society_apostolic_life','personal_prelature','military_ordinariate','other','unknown') then
      raise exception 'Tipo de incardinación inválido' using errcode = '22023';
    end if;
    if v_incardination_method not in ('ordination','incardination','transfer','profession','reception','unknown') then
      raise exception 'Método de incardinación inválido' using errcode = '22023';
    end if;

    if v_incardination_entity_id is not null or (v_priest_type = 'religious' and v_religious_name is not null) then
      if not exists (
        select 1 from public.clerical_incardinations ci
        where ci.person_id = v_person_id
          and ci.is_current = true and ci.record_status = 'active'
          and ci.incardination_entity_id is not distinct from v_incardination_entity_id
          and ci.incardination_kind = v_incardination_kind
          and ci.institute_name is not distinct from case when v_priest_type = 'religious' then v_religious_name else null end
      ) then
        insert into public.clerical_incardinations (
          person_id, incardination_entity_id, institute_name, incardination_kind,
          acquisition_method, start_date, is_current, source_name, source_url,
          source_checked_at, verification_status, visibility, record_status,
          record_origin, notes_internal, created_by
        ) values (
          v_person_id, v_incardination_entity_id,
          case when v_priest_type = 'religious' then v_religious_name else null end,
          v_incardination_kind, v_incardination_method, v_incardination_start, true,
          nullif(btrim(payload->>'source_name'), ''), nullif(btrim(payload->>'source_url'), ''),
          nullif(payload->>'source_checked_at', '')::date,
          coalesce(nullif(payload->>'verification_status', ''), 'pending_review'),
          'internal', 'active', 'canonical_registration_engine',
          'Incardinación registrada por el motor canónico común.', v_user_id
        );
      end if;
    end if;
  end if;

  if v_flow = 'religious' or v_priest_type = 'religious' or v_religious_name is not null then
    if v_religious_life_type not in ('brother','sister','consecrated_lay','other') then
      raise exception 'Tipo de vida consagrada inválido' using errcode = '22023';
    end if;
    if v_religious_status not in ('active','retired','transferred','deceased','unknown') then
      raise exception 'Estado de vida consagrada inválido' using errcode = '22023';
    end if;

    insert into public.religious_profiles (
      person_id, religious_life_type, community_name, province_name,
      profession_date, canonical_status, current_service_entity_id,
      notes_private, created_by
    ) values (
      v_person_id, v_religious_life_type, v_religious_name,
      coalesce(nullif(btrim(payload->>'province_name'), ''), nullif(btrim(payload->>'religious_province_name'), '')),
      nullif(payload->>'profession_date', '')::date, v_religious_status,
      nullif(payload->>'current_service_entity_id', '')::uuid,
      nullif(btrim(payload->>'religious_notes'), ''), v_user_id
    )
    on conflict (person_id) do update set
      religious_life_type = coalesce(excluded.religious_life_type, public.religious_profiles.religious_life_type),
      community_name = coalesce(excluded.community_name, public.religious_profiles.community_name),
      province_name = coalesce(excluded.province_name, public.religious_profiles.province_name),
      profession_date = coalesce(excluded.profession_date, public.religious_profiles.profession_date),
      canonical_status = coalesce(excluded.canonical_status, public.religious_profiles.canonical_status),
      current_service_entity_id = coalesce(excluded.current_service_entity_id, public.religious_profiles.current_service_entity_id),
      notes_private = concat_ws(E'\n', public.religious_profiles.notes_private, excluded.notes_private),
      updated_at = now()
    returning id into v_religious_profile_id;
  end if;

  if v_flow = 'bishop' then
    insert into public.episcopal_ordinations (
      bishop_person_id, ordination_date, ordination_place,
      principal_consecrator_person_id, co_consecrator_1_person_id, co_consecrator_2_person_id,
      principal_consecrator_name, co_consecrator_1_name, co_consecrator_2_name,
      source_name, source_url, source_checked_at, verification_status,
      visibility, status, notes_public, notes_internal, created_by
    ) values (
      v_person_id, nullif(payload->>'episcopal_ordination_date', '')::date,
      coalesce(nullif(btrim(payload->>'episcopal_ordination_place'), ''), nullif(btrim(payload->>'ordination_place'), '')),
      nullif(payload->>'principal_consecrator_person_id', '')::uuid,
      nullif(payload->>'co_consecrator_1_person_id', '')::uuid,
      nullif(payload->>'co_consecrator_2_person_id', '')::uuid,
      nullif(btrim(payload->>'principal_consecrator_name'), ''),
      nullif(btrim(payload->>'co_consecrator_1_name'), ''),
      nullif(btrim(payload->>'co_consecrator_2_name'), ''),
      nullif(btrim(payload->>'source_name'), ''), nullif(btrim(payload->>'source_url'), ''),
      nullif(payload->>'source_checked_at', '')::date,
      coalesce(nullif(payload->>'verification_status', ''), 'pending_review'),
      'public', 'active', nullif(btrim(payload->>'ordination_notes_public'), ''),
      'Sucesión episcopal sincronizada por el motor canónico común.', v_user_id
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
      status = 'active', updated_at = now();

    if v_role_type is not null then
      if v_role_type not in ('diocesan','auxiliary','coadjutor','titular','emeritus','apostolic_administrator','apostolic_vicar','apostolic_prefect','other') then
        raise exception 'Función episcopal inválida' using errcode = '22023';
      end if;

      select er.id into v_episcopal_role_id
      from public.episcopal_roles er
      where er.person_id = v_person_id
        and er.role_type = v_role_type
        and er.jurisdiction_entity_id is not distinct from v_role_entity_id
        and er.is_current = true and er.record_status = 'active'
      limit 1;

      if v_episcopal_role_id is null then
        insert into public.episcopal_roles (
          person_id, role_type, jurisdiction_entity_id, title_see_name,
          start_date, is_current, has_right_of_succession,
          source_name, source_url, source_checked_at, verification_status,
          visibility, record_status, record_origin, notes_public, notes_internal, created_by
        ) values (
          v_person_id, v_role_type, v_role_entity_id,
          nullif(btrim(payload->>'title_see_name'), ''), v_assignment_start_date,
          true, v_role_type = 'coadjutor',
          nullif(btrim(payload->>'source_name'), ''), nullif(btrim(payload->>'source_url'), ''),
          nullif(payload->>'source_checked_at', '')::date,
          coalesce(nullif(payload->>'verification_status', ''), 'pending_review'),
          'public', 'active', 'canonical_registration_engine',
          nullif(btrim(payload->>'appointment_notes_public'), ''),
          'Función episcopal registrada por el motor canónico común.', v_user_id
        ) returning id into v_episcopal_role_id;
      else
        update public.episcopal_roles
        set title_see_name = coalesce(nullif(btrim(payload->>'title_see_name'), ''), title_see_name),
            start_date = coalesce(start_date, v_assignment_start_date),
            source_name = coalesce(source_name, nullif(btrim(payload->>'source_name'), '')),
            source_url = coalesce(source_url, nullif(btrim(payload->>'source_url'), '')),
            source_checked_at = coalesce(source_checked_at, nullif(payload->>'source_checked_at', '')::date),
            updated_at = now()
        where id = v_episcopal_role_id;
      end if;
    end if;

    if payload ? 'dignities' and jsonb_typeof(payload->'dignities') <> 'array' then
      raise exception 'Las dignidades deben enviarse como una lista' using errcode = '22023';
    end if;

    for v_dignity in
      select distinct value
      from jsonb_array_elements_text(coalesce(payload->'dignities', '[]'::jsonb)) d(value)
    loop
      if v_dignity not in ('archbishop','metropolitan','cardinal','monsignor','patriarch','major_archbishop','other') then
        raise exception 'Dignidad eclesiástica inválida' using errcode = '22023';
      end if;

      update public.person_ecclesiastical_dignities
      set title_text = coalesce(nullif(btrim(payload->>'title_override'), ''), title_text),
          start_date = coalesce(start_date, v_assignment_start_date),
          source_name = coalesce(source_name, nullif(btrim(payload->>'source_name'), '')),
          source_url = coalesce(source_url, nullif(btrim(payload->>'source_url'), '')),
          source_checked_at = coalesce(source_checked_at, nullif(payload->>'source_checked_at', '')::date),
          updated_at = now()
      where person_id = v_person_id and dignity_type = v_dignity
        and is_current = true and record_status = 'active';

      if not found then
        insert into public.person_ecclesiastical_dignities (
          person_id, dignity_type, title_text, start_date, is_current,
          source_name, source_url, source_checked_at, verification_status,
          visibility, record_status, record_origin, notes_internal, created_by
        ) values (
          v_person_id, v_dignity, nullif(btrim(payload->>'title_override'), ''),
          v_assignment_start_date, true,
          nullif(btrim(payload->>'source_name'), ''), nullif(btrim(payload->>'source_url'), ''),
          nullif(payload->>'source_checked_at', '')::date,
          coalesce(nullif(payload->>'verification_status', ''), 'pending_review'),
          'public', 'active', 'canonical_registration_engine',
          'Dignidad registrada por el motor canónico común.', v_user_id
        );
      end if;
    end loop;
  end if;

  if v_has_assignment then
    v_assignment_visibility := coalesce(
      nullif(payload->>'assignment_visibility', ''),
      case when v_flow in ('layperson', 'religious') then 'internal' else 'public' end
    );

    v_assignment_result := internal.admin_save_position_assignment(
      jsonb_build_object(
        'person_id', v_person_id,
        'office_configuration_id', v_office_configuration_id,
        'ecclesiastical_entity_id', v_target_entity_id,
        'title_override', coalesce(nullif(btrim(payload->>'quick_title_override'), ''), nullif(btrim(payload->>'title_override'), '')),
        'start_date', v_assignment_start_date,
        'term_start_date', v_assignment_start_date,
        'assignment_status', 'active',
        'selection_method', 'appointment',
        'notes_public', coalesce(nullif(btrim(payload->>'quick_notes_public'), ''), nullif(btrim(payload->>'appointment_notes_public'), '')),
        'notes_internal', 'Asignación creada por el motor canónico común.',
        'source_name', nullif(btrim(payload->>'source_name'), ''),
        'source_url', nullif(btrim(payload->>'source_url'), ''),
        'source_checked_at', nullif(payload->>'source_checked_at', '')::date,
        'verification_status', coalesce(nullif(payload->>'verification_status', ''), 'pending_review'),
        'visibility', v_assignment_visibility,
        'close_previous_current', true
      )
    );
    v_assignment_id := nullif(v_assignment_result->>'assignment_id', '')::uuid;

    if v_episcopal_role_id is not null then
      update public.episcopal_roles
      set source_position_assignment_id = coalesce(source_position_assignment_id, v_assignment_id),
          updated_at = now()
      where id = v_episcopal_role_id;
    end if;
  end if;

  perform public.admin_mark_missing_fields(
    'persons', v_person_id, payload->'not_identified_fields',
    array['gender','birth_date','birth_place','biography_public'],
    'Marcado como no identificado desde el motor canónico común.', v_user_id
  );

  if v_clergy_profile_id is not null then
    perform public.admin_mark_missing_fields(
      'clergy_profiles', v_clergy_profile_id, payload->'not_identified_fields',
      array['diaconal_ordination_date','priestly_ordination_date','incardination_entity_id','current_service_entity_id'],
      'Marcado como no identificado desde el motor canónico común.', v_user_id
    );
  end if;

  if v_religious_profile_id is not null then
    perform public.admin_mark_missing_fields(
      'religious_profiles', v_religious_profile_id, payload->'not_identified_fields',
      array['community_name','profession_date','current_service_entity_id'],
      'Marcado como no identificado desde el motor canónico común.', v_user_id
    );
  end if;

  select pes.effective_person_type
  into v_effective_person_type
  from public.person_ecclesial_state pes
  where pes.id = v_person_id;

  return jsonb_build_object(
    'person_id', v_person_id,
    'clergy_profile_id', v_clergy_profile_id,
    'religious_profile_id', v_religious_profile_id,
    'assignment_id', v_assignment_id,
    'closed_previous_current_count', coalesce((v_assignment_result->>'closed_previous_current_count')::integer, 0),
    'episcopal_role_id', v_episcopal_role_id,
    'slug', v_slug,
    'internal_reference_code', v_internal_code,
    'flow', v_flow,
    'mode', v_mode,
    'effective_person_type', v_effective_person_type
  );
end;
$$;

create or replace function public.admin_save_canonical_person(payload jsonb)
returns jsonb
language sql
set search_path = public, internal, pg_temp
as $$
  select internal.admin_save_canonical_person(payload);
$$;

create or replace function public.admin_save_deacon(payload jsonb)
returns jsonb
language sql
set search_path = public, internal, pg_temp
as $$
  select internal.admin_save_canonical_person(
    payload || jsonb_build_object(
      'flow', 'deacon',
      'selected_person_id', payload->'selected_person_id',
      'mode', coalesce(payload->'mode', case when payload ? 'selected_person_id' then '"existing"'::jsonb else '"new"'::jsonb end)
    )
  );
$$;

create or replace function public.admin_save_priest(payload jsonb)
returns jsonb
language sql
set search_path = public, internal, pg_temp
as $$
  select internal.admin_save_canonical_person(
    payload || jsonb_build_object(
      'flow', 'priest',
      'selected_person_id', payload->'existing_deacon_person_id',
      'mode', case when nullif(payload->>'existing_deacon_person_id', '') is null then 'new' else 'existing' end
    )
  );
$$;

create or replace function public.admin_save_bishop(payload jsonb)
returns jsonb
language sql
set search_path = public, internal, pg_temp
as $$
  select internal.admin_save_canonical_person(
    payload || jsonb_build_object(
      'flow', 'bishop',
      'selected_person_id', payload->'selected_clergy_id',
      'mode', coalesce(nullif(payload->>'mode', ''), case when nullif(payload->>'selected_clergy_id', '') is null then 'new' else 'existing' end)
    )
  );
$$;

create or replace function public.admin_save_religious(payload jsonb)
returns jsonb
language sql
set search_path = public, internal, pg_temp
as $$
  select internal.admin_save_canonical_person(
    payload || jsonb_build_object(
      'flow', 'religious',
      'selected_person_id', payload->'selected_person_id',
      'mode', case when nullif(payload->>'selected_person_id', '') is null then 'new' else 'existing' end
    )
  );
$$;

create or replace function public.admin_save_layperson(payload jsonb)
returns jsonb
language sql
set search_path = public, internal, pg_temp
as $$
  select internal.admin_save_canonical_person(
    payload || jsonb_build_object(
      'flow', 'layperson',
      'selected_person_id', payload->'selected_person_id',
      'mode', case when nullif(payload->>'selected_person_id', '') is null then 'new' else 'existing' end
    )
  );
$$;

revoke all on function internal.admin_save_canonical_person(jsonb) from public, anon;
grant execute on function internal.admin_save_canonical_person(jsonb) to authenticated;

revoke all on function public.admin_save_canonical_person(jsonb) from public, anon;
grant execute on function public.admin_save_canonical_person(jsonb) to authenticated;

revoke all on function public.admin_save_deacon(jsonb) from public, anon;
revoke all on function public.admin_save_priest(jsonb) from public, anon;
revoke all on function public.admin_save_bishop(jsonb) from public, anon;
revoke all on function public.admin_save_religious(jsonb) from public, anon;
revoke all on function public.admin_save_layperson(jsonb) from public, anon;

grant execute on function public.admin_save_deacon(jsonb) to authenticated;
grant execute on function public.admin_save_priest(jsonb) to authenticated;
grant execute on function public.admin_save_bishop(jsonb) to authenticated;
grant execute on function public.admin_save_religious(jsonb) to authenticated;
grant execute on function public.admin_save_layperson(jsonb) to authenticated;

comment on function internal.admin_save_canonical_person(jsonb) is
  'Motor transaccional común para reutilizar o crear una identidad y añadir dimensiones laicales, de vida consagrada y de Orden sagrado.';
comment on function public.admin_save_canonical_person(jsonb) is
  'Contrato administrativo canónico común. Los RPC especializados se conservan como adaptadores de compatibilidad.';
