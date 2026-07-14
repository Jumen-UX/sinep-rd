create or replace function app_private.rpc_definer__admin_save_organization_unit(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','internal','app_private','auth','pg_temp'
as $function$
declare
  v_existing_id uuid := app_private.audit_json_uuid(payload,'id');
  v_entity_id uuid := app_private.audit_json_uuid(payload,'ecclesiastical_entity_id');
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
  v_id uuid;
  v_permission text;
  v_action text;
  v_content_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado.' using errcode='42501';
  end if;

  if v_existing_id is not null then
    select ou.ecclesiastical_entity_id,to_jsonb(ou)
      into v_entity_id,v_old
    from public.organization_units ou
    where ou.id=v_existing_id;

    if v_entity_id is null then
      raise exception 'La unidad organizativa indicada no existe.' using errcode='P0002';
    end if;
    v_permission := 'pastorals.update_proposal';
  else
    v_permission := 'pastorals.create_proposal';
  end if;

  if v_entity_id is null or not app_private.current_user_can_manage_entity(v_permission,v_entity_id) then
    raise exception 'No autorizado para modificar unidades organizativas en este ámbito.' using errcode='42501';
  end if;

  v_content_payload := payload - 'status' - 'visibility' - 'is_current';
  if v_existing_id is null then
    v_content_payload := v_content_payload || jsonb_build_object(
      'status','draft',
      'visibility','internal',
      'is_current',true
    );
  end if;

  v_result := internal.admin_save_organization_unit(v_content_payload);
  v_id := app_private.audit_json_uuid(v_result,'id');
  select to_jsonb(ou) into v_new
  from public.organization_units ou
  where ou.id=v_id;

  v_action := case
    when v_existing_id is null then 'pastorals.organization_unit.created'
    else 'pastorals.organization_unit.updated'
  end;

  perform public.create_audit_log(
    auth.uid(),v_action,'organization_units',v_id,v_old,
    jsonb_build_object(
      'scope_type','organization_unit',
      'scope_entity_id',v_entity_id,
      'organization_unit_id',v_id,
      'record',v_new,
      'result',v_result
    ),
    app_private.audit_json_uuid(payload,'change_request_id')
  );

  return v_result;
end;
$function$;

revoke all on function app_private.rpc_definer__admin_save_organization_unit(jsonb) from public,anon,authenticated;
grant execute on function app_private.rpc_definer__admin_save_organization_unit(jsonb) to service_role;
