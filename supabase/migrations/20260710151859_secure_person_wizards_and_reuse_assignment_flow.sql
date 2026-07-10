-- Priority 0: apply permission/scope enforcement and canonical assignment handling
-- to deacon, layperson and religious creation flows.

begin;

create or replace function public.admin_save_deacon(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_target_entity_id uuid := coalesce(
    nullif(payload->>'quick_entity_id', '')::uuid,
    nullif(payload->>'current_service_entity_id', '')::uuid,
    nullif(payload->>'incardination_entity_id', '')::uuid
  );
  v_has_assignment boolean := nullif(payload->>'quick_office_configuration_id', '') is not null;
  v_person_result jsonb;
  v_assignment_result jsonb := '{}'::jsonb;
  v_person_id uuid;
begin
  if not public.current_user_has_permission('people.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear diáconos' using errcode = '42501';
  end if;

  if v_target_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'Debes indicar una entidad de incardinación o servicio dentro de tu alcance' using errcode = '42501';
  end if;

  if v_target_entity_id is not null
     and not app_private.current_user_can_manage_entity('people.create_proposal', v_target_entity_id) then
    raise exception 'La entidad seleccionada para el diácono está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_has_assignment then
    if not public.current_user_has_permission('appointments.create_proposal')
       and not public.current_user_is_super_or_national() then
      raise exception 'No autorizado para crear el nombramiento del diácono' using errcode = '42501';
    end if;

    if v_target_entity_id is null
       or not app_private.current_user_can_manage_entity('appointments.create_proposal', v_target_entity_id) then
      raise exception 'La entidad del nombramiento está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  v_person_result := internal.admin_save_deacon(payload - 'quick_office_configuration_id');
  v_person_id := nullif(v_person_result->>'person_id', '')::uuid;

  if v_has_assignment then
    v_assignment_result := internal.admin_save_position_assignment(
      jsonb_build_object(
        'person_id', v_person_id,
        'office_configuration_id', nullif(payload->>'quick_office_configuration_id', '')::uuid,
        'ecclesiastical_entity_id', v_target_entity_id,
        'title_override', nullif(btrim(payload->>'quick_title_override'), ''),
        'start_date', nullif(payload->>'quick_start_date', '')::date,
        'term_start_date', nullif(payload->>'quick_start_date', '')::date,
        'assignment_status', 'active',
        'selection_method', 'appointment',
        'notes_public', nullif(btrim(payload->>'quick_notes_public'), ''),
        'notes_internal', 'Asignación creada desde asistente transaccional de nuevo diácono.',
        'verification_status', 'pending_review',
        'visibility', 'public',
        'close_previous_current', true
      )
    );
  end if;

  return v_person_result || v_assignment_result;
end;
$$;

create or replace function public.admin_save_layperson(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_target_entity_id uuid := nullif(payload->>'quick_entity_id', '')::uuid;
  v_has_assignment boolean := nullif(payload->>'quick_office_configuration_id', '') is not null;
  v_person_result jsonb;
  v_assignment_result jsonb := '{}'::jsonb;
  v_person_id uuid;
begin
  if not public.current_user_has_permission('people.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear laicos' using errcode = '42501';
  end if;

  if v_target_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'Debes indicar una entidad de servicio dentro de tu alcance' using errcode = '42501';
  end if;

  if v_target_entity_id is not null
     and not app_private.current_user_can_manage_entity('people.create_proposal', v_target_entity_id) then
    raise exception 'La entidad seleccionada para el laico está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_has_assignment then
    if not public.current_user_has_permission('appointments.create_proposal')
       and not public.current_user_is_super_or_national() then
      raise exception 'No autorizado para crear el nombramiento del laico' using errcode = '42501';
    end if;

    if v_target_entity_id is null
       or not app_private.current_user_can_manage_entity('appointments.create_proposal', v_target_entity_id) then
      raise exception 'La entidad del nombramiento está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  v_person_result := internal.admin_save_layperson(payload - 'quick_office_configuration_id');
  v_person_id := nullif(v_person_result->>'person_id', '')::uuid;

  if v_has_assignment then
    v_assignment_result := internal.admin_save_position_assignment(
      jsonb_build_object(
        'person_id', v_person_id,
        'office_configuration_id', nullif(payload->>'quick_office_configuration_id', '')::uuid,
        'ecclesiastical_entity_id', v_target_entity_id,
        'title_override', nullif(btrim(payload->>'quick_title_override'), ''),
        'start_date', nullif(payload->>'quick_start_date', '')::date,
        'term_start_date', nullif(payload->>'quick_start_date', '')::date,
        'assignment_status', 'active',
        'selection_method', 'appointment',
        'notes_public', nullif(btrim(payload->>'quick_notes_public'), ''),
        'notes_internal', 'Asignación creada desde asistente transaccional de nuevo laico.',
        'verification_status', 'pending_review',
        'visibility', coalesce(nullif(payload->>'assignment_visibility', ''), 'internal'),
        'close_previous_current', true
      )
    );
  end if;

  return v_person_result || v_assignment_result;
end;
$$;

create or replace function public.admin_save_religious(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_target_entity_id uuid := coalesce(
    nullif(payload->>'quick_entity_id', '')::uuid,
    nullif(payload->>'current_service_entity_id', '')::uuid
  );
  v_has_assignment boolean := nullif(payload->>'quick_office_configuration_id', '') is not null;
  v_person_result jsonb;
  v_assignment_result jsonb := '{}'::jsonb;
  v_person_id uuid;
begin
  if not public.current_user_has_permission('people.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear religiosos' using errcode = '42501';
  end if;

  if v_target_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'Debes indicar una entidad de servicio dentro de tu alcance' using errcode = '42501';
  end if;

  if v_target_entity_id is not null
     and not app_private.current_user_can_manage_entity('people.create_proposal', v_target_entity_id) then
    raise exception 'La entidad seleccionada para el religioso está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_has_assignment then
    if not public.current_user_has_permission('appointments.create_proposal')
       and not public.current_user_is_super_or_national() then
      raise exception 'No autorizado para crear el nombramiento del religioso' using errcode = '42501';
    end if;

    if v_target_entity_id is null
       or not app_private.current_user_can_manage_entity('appointments.create_proposal', v_target_entity_id) then
      raise exception 'La entidad del nombramiento está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  v_person_result := internal.admin_save_religious(payload - 'quick_office_configuration_id');
  v_person_id := nullif(v_person_result->>'person_id', '')::uuid;

  if v_has_assignment then
    v_assignment_result := internal.admin_save_position_assignment(
      jsonb_build_object(
        'person_id', v_person_id,
        'office_configuration_id', nullif(payload->>'quick_office_configuration_id', '')::uuid,
        'ecclesiastical_entity_id', v_target_entity_id,
        'title_override', nullif(btrim(payload->>'quick_title_override'), ''),
        'start_date', nullif(payload->>'quick_start_date', '')::date,
        'term_start_date', nullif(payload->>'quick_start_date', '')::date,
        'assignment_status', 'active',
        'selection_method', 'appointment',
        'notes_public', nullif(btrim(payload->>'quick_notes_public'), ''),
        'notes_internal', 'Asignación creada desde asistente transaccional de nuevo religioso.',
        'verification_status', 'pending_review',
        'visibility', coalesce(nullif(payload->>'assignment_visibility', ''), 'internal'),
        'close_previous_current', true
      )
    );
  end if;

  return v_person_result || v_assignment_result;
end;
$$;

revoke all on function public.admin_save_deacon(jsonb) from public, anon;
revoke all on function public.admin_save_layperson(jsonb) from public, anon;
revoke all on function public.admin_save_religious(jsonb) from public, anon;

grant execute on function public.admin_save_deacon(jsonb) to authenticated;
grant execute on function public.admin_save_layperson(jsonb) to authenticated;
grant execute on function public.admin_save_religious(jsonb) to authenticated;

commit;
