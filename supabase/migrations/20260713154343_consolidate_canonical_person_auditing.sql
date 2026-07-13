create or replace function public.admin_save_canonical_person(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_selected_person_id uuid := coalesce(
    app_private.audit_json_uuid(payload, 'selected_person_id'),
    app_private.audit_json_uuid(payload, 'existing_deacon_person_id'),
    app_private.audit_json_uuid(payload, 'selected_clergy_id')
  );
  v_scope_entity_id uuid := coalesce(
    app_private.audit_json_uuid(payload, 'quick_entity_id'),
    app_private.audit_json_uuid(payload, 'assignment_entity_id'),
    app_private.audit_json_uuid(payload, 'jurisdiction_entity_id'),
    app_private.audit_json_uuid(payload, 'current_service_entity_id'),
    app_private.audit_json_uuid(payload, 'incardination_entity_id'),
    app_private.audit_json_uuid(payload, 'religious_house_entity_id'),
    app_private.current_user_root_jurisdiction_id()
  );
  v_result jsonb;
  v_person_id uuid;
  v_assignment_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_assignment_new jsonb;
begin
  if v_selected_person_id is not null then
    select to_jsonb(p) into v_old from public.persons p where p.id = v_selected_person_id;
  end if;

  v_result := internal.admin_save_canonical_person(payload);
  v_person_id := app_private.audit_json_uuid(v_result, 'person_id');
  v_assignment_id := app_private.audit_json_uuid(v_result, 'assignment_id');

  select to_jsonb(p) into v_new from public.persons p where p.id = v_person_id;

  perform public.create_audit_log(
    auth.uid(),
    case when v_old is null then 'people.person.created' else 'people.person.updated' end,
    'persons', v_person_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  if v_assignment_id is not null then
    select to_jsonb(pa) into v_assignment_new from public.position_assignments pa where pa.id = v_assignment_id;
    perform public.create_audit_log(
      auth.uid(), 'appointments.assignment.created', 'position_assignments', v_assignment_id, null,
      jsonb_build_object('scope_entity_id', v_scope_entity_id, 'record', v_assignment_new, 'source', 'canonical_person_registration'),
      app_private.audit_json_uuid(payload, 'change_request_id')
    );
  end if;

  return v_result;
end;
$$;

revoke all on function internal.admin_save_canonical_person(jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_canonical_person(jsonb) to authenticated, service_role;
