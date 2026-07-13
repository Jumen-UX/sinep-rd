create or replace function public.admin_save_position_assignment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_entity_id uuid := app_private.audit_json_uuid(payload, 'ecclesiastical_entity_id');
  v_pastoral_entity_id uuid := app_private.audit_json_uuid(payload, 'pastoral_entity_id');
  v_unit_id uuid := app_private.audit_json_uuid(payload, 'organization_unit_id');
  v_predecessor_id uuid := app_private.audit_json_uuid(payload, 'predecessor_assignment_id');
  v_successor_id uuid := app_private.audit_json_uuid(payload, 'successor_assignment_id');
  v_related_entity_id uuid;
  v_related_pastoral_id uuid;
  v_result jsonb;
  v_assignment_id uuid;
  v_new jsonb;
begin
  if not public.current_user_has_permission('appointments.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear nombramientos' using errcode = '42501';
  end if;

  if v_unit_id is not null then
    select ou.ecclesiastical_entity_id, ou.pastoral_entity_id
      into v_related_entity_id, v_related_pastoral_id
    from public.organization_units ou where ou.id = v_unit_id;
    v_entity_id := coalesce(v_entity_id, v_related_entity_id);
    v_pastoral_entity_id := coalesce(v_pastoral_entity_id, v_related_pastoral_id);
  end if;

  if v_entity_id is null and v_pastoral_entity_id is null
     and not public.current_user_is_super_or_national() then
    raise exception 'El nombramiento debe indicar una entidad dentro de tu alcance' using errcode = '42501';
  end if;

  if v_entity_id is not null
     and not app_private.current_user_can_manage_entity('appointments.create_proposal', v_entity_id) then
    raise exception 'La entidad del nombramiento está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_pastoral_entity_id is not null
     and not (
       public.current_user_has_permission('appointments.create_proposal')
       and public.current_user_has_scope_access('pastoral_entity', v_pastoral_entity_id, null, null, v_pastoral_entity_id)
     )
     and not public.current_user_is_super_or_national() then
    raise exception 'La entidad pastoral del nombramiento está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_predecessor_id is not null then
    select pa.ecclesiastical_entity_id, pa.pastoral_entity_id
      into v_related_entity_id, v_related_pastoral_id
    from public.position_assignments pa where pa.id = v_predecessor_id;
    if v_related_entity_id is not null
       and not app_private.current_user_can_manage_entity('appointments.create_proposal', v_related_entity_id) then
      raise exception 'El nombramiento predecesor está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  if v_successor_id is not null then
    select pa.ecclesiastical_entity_id, pa.pastoral_entity_id
      into v_related_entity_id, v_related_pastoral_id
    from public.position_assignments pa where pa.id = v_successor_id;
    if v_related_entity_id is not null
       and not app_private.current_user_can_manage_entity('appointments.create_proposal', v_related_entity_id) then
      raise exception 'El nombramiento sucesor está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  v_result := internal.admin_save_position_assignment(payload);
  v_assignment_id := app_private.audit_json_uuid(v_result, 'assignment_id');
  select to_jsonb(pa) into v_new from public.position_assignments pa where pa.id = v_assignment_id;

  perform public.create_audit_log(
    auth.uid(), 'appointments.assignment.created', 'position_assignments', v_assignment_id, null,
    jsonb_build_object('scope_entity_id', v_entity_id, 'pastoral_entity_id', v_pastoral_entity_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

revoke all on function internal.admin_save_position_assignment(jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_position_assignment(jsonb) to authenticated, service_role;
