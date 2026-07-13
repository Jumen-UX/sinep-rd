create or replace function public.admin_mark_person_deceased(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_person_id uuid := app_private.audit_json_uuid(payload, 'person_id');
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
  v_scope_entity_id uuid;
begin
  if not public.current_user_has_permission('people.update_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para registrar fallecimientos' using errcode = '42501';
  end if;

  if v_person_id is null then
    raise exception 'Falta seleccionar la persona' using errcode = '22023';
  end if;

  if not app_private.current_user_can_manage_person('people.update_proposal', v_person_id)
     and not public.current_user_is_super_or_national() then
    raise exception 'La persona está fuera de tu alcance' using errcode = '42501';
  end if;

  select to_jsonb(p) into v_old from public.persons p where p.id = v_person_id;
  select coalesce(
    (select pa.ecclesiastical_entity_id from public.position_assignments pa where pa.person_id = v_person_id and pa.is_current and pa.record_status = 'active' and pa.ecclesiastical_entity_id is not null order by pa.updated_at desc limit 1),
    (select cp.current_service_entity_id from public.clergy_profiles cp where cp.person_id = v_person_id),
    app_private.current_user_root_jurisdiction_id()
  ) into v_scope_entity_id;

  v_result := internal.admin_mark_person_deceased(payload);
  select to_jsonb(p) into v_new from public.persons p where p.id = v_person_id;

  perform public.create_audit_log(
    auth.uid(), 'people.person.deceased', 'persons', v_person_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

revoke all on function internal.admin_mark_person_deceased(jsonb) from public, anon, authenticated;
grant execute on function public.admin_mark_person_deceased(jsonb) to authenticated, service_role;
