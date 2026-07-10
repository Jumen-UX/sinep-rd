-- Priority 0: keep bishop conversion/profile/ordination and appointment in one
-- transaction while reusing the canonical predecessor/successor operation.

begin;

create or replace function public.admin_save_bishop(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_target_entity_id uuid := coalesce(
    nullif(payload->>'assignment_entity_id', '')::uuid,
    nullif(payload->>'incardination_entity_id', '')::uuid
  );
  v_has_assignment boolean := nullif(payload->>'office_configuration_id', '') is not null;
  v_person_result jsonb;
  v_assignment_result jsonb := '{}'::jsonb;
  v_person_id uuid;
begin
  if not public.current_user_has_permission('people.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear personas' using errcode = '42501';
  end if;

  if v_target_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'Debes indicar una jurisdicción dentro de tu alcance' using errcode = '42501';
  end if;

  if v_target_entity_id is not null
     and not app_private.current_user_can_manage_entity('people.create_proposal', v_target_entity_id) then
    raise exception 'La jurisdicción seleccionada para el obispo está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_has_assignment then
    if not public.current_user_has_permission('appointments.create_proposal')
       and not public.current_user_is_super_or_national() then
      raise exception 'No autorizado para crear el nombramiento episcopal' using errcode = '42501';
    end if;

    if v_target_entity_id is null
       or not app_private.current_user_can_manage_entity('appointments.create_proposal', v_target_entity_id) then
      raise exception 'No autorizado para crear el nombramiento episcopal en esta jurisdicción' using errcode = '42501';
    end if;
  end if;

  v_person_result := internal.admin_save_bishop(payload - 'office_configuration_id');
  v_person_id := nullif(v_person_result->>'person_id', '')::uuid;

  if v_has_assignment then
    v_assignment_result := internal.admin_save_position_assignment(
      jsonb_build_object(
        'person_id', v_person_id,
        'office_configuration_id', nullif(payload->>'office_configuration_id', '')::uuid,
        'ecclesiastical_entity_id', v_target_entity_id,
        'title_override', nullif(btrim(payload->>'title_override'), ''),
        'start_date', nullif(payload->>'appointment_start_date', '')::date,
        'term_start_date', nullif(payload->>'appointment_start_date', '')::date,
        'assignment_status', 'active',
        'selection_method', 'appointment',
        'notes_public', nullif(btrim(payload->>'appointment_notes_public'), ''),
        'notes_internal', 'Cargo episcopal creado desde asistente transaccional.',
        'source_name', nullif(btrim(payload->>'source_name'), ''),
        'source_url', nullif(btrim(payload->>'source_url'), ''),
        'source_checked_at', nullif(payload->>'source_checked_at', '')::date,
        'verification_status', 'pending_review',
        'visibility', 'public',
        'close_previous_current', true
      )
    );
  end if;

  return v_person_result || v_assignment_result;
end;
$$;

revoke all on function public.admin_save_bishop(jsonb) from public, anon;
grant execute on function public.admin_save_bishop(jsonb) to authenticated;

commit;
