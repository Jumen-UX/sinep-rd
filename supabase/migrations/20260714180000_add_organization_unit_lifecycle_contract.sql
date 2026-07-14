create or replace function app_private.rpc_definer__admin_transition_organization_unit(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_id uuid := app_private.audit_json_uuid(payload,'id');
  v_action text := nullif(btrim(payload->>'action'),'');
  v_unit public.organization_units%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_permission text;
  v_audit_action text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado.' using errcode='42501';
  end if;
  if v_id is null or v_action is null then
    raise exception 'La unidad y la acción son obligatorias.' using errcode='22023';
  end if;

  select * into v_unit from public.organization_units where id=v_id for update;
  if not found then
    raise exception 'La unidad organizativa indicada no existe.' using errcode='P0002';
  end if;

  if v_action in ('approve','deactivate','archive','restore_draft') then
    v_permission := case when v_action='approve' then 'pastorals.approve' else 'pastorals.update_proposal' end;
  elsif v_action in ('publish','unpublish') then
    v_permission := 'pastorals.publish';
  else
    raise exception 'Acción de ciclo de vida no admitida.' using errcode='22023';
  end if;

  if not app_private.current_user_can_manage_entity(v_permission,v_unit.ecclesiastical_entity_id) then
    raise exception 'No autorizado para cambiar el ciclo de vida de esta unidad.' using errcode='42501';
  end if;

  v_old := to_jsonb(v_unit);

  case v_action
    when 'approve' then
      if v_unit.status <> 'draft' then raise exception 'Solo se pueden aprobar unidades en borrador.' using errcode='22023'; end if;
      update public.organization_units set status='active',updated_at=now() where id=v_id;
      v_audit_action := 'pastorals.organization_unit.approved';
    when 'publish' then
      if v_unit.status <> 'active' or not v_unit.is_current then
        raise exception 'Solo se pueden publicar unidades activas y vigentes.' using errcode='22023';
      end if;
      update public.organization_units set visibility='public',updated_at=now() where id=v_id;
      v_audit_action := 'pastorals.organization_unit.published';
    when 'unpublish' then
      update public.organization_units set visibility='internal',updated_at=now() where id=v_id;
      v_audit_action := 'pastorals.organization_unit.unpublished';
    when 'deactivate' then
      update public.organization_units set status='inactive',visibility=case when visibility='public' then 'internal' else visibility end,updated_at=now() where id=v_id;
      v_audit_action := 'pastorals.organization_unit.deactivated';
    when 'archive' then
      update public.organization_units set status='archived',visibility='internal',is_current=false,valid_to=coalesce(valid_to,current_date),updated_at=now() where id=v_id;
      v_audit_action := 'pastorals.organization_unit.archived';
    when 'restore_draft' then
      update public.organization_units set status='draft',visibility='internal',is_current=true,valid_to=null,updated_at=now() where id=v_id;
      v_audit_action := 'pastorals.organization_unit.restored_to_draft';
  end case;

  select to_jsonb(ou) into v_new from public.organization_units ou where ou.id=v_id;
  perform public.create_audit_log(
    auth.uid(),v_audit_action,'organization_units',v_id,v_old,
    jsonb_build_object('scope_type','organization_unit','scope_entity_id',v_unit.ecclesiastical_entity_id,'organization_unit_id',v_id,'record',v_new),
    app_private.audit_json_uuid(payload,'change_request_id')
  );
  return v_new;
end;
$function$;

create or replace function public.admin_transition_organization_unit(payload jsonb)
returns jsonb
language sql
set search_path to 'pg_catalog','public','app_private','auth','pg_temp'
as $function$
  select app_private.rpc_definer__admin_transition_organization_unit(payload)
$function$;

revoke all on function app_private.rpc_definer__admin_transition_organization_unit(jsonb) from public,anon,authenticated;
grant execute on function app_private.rpc_definer__admin_transition_organization_unit(jsonb) to service_role;
revoke all on function public.admin_transition_organization_unit(jsonb) from public,anon;
grant execute on function public.admin_transition_organization_unit(jsonb) to authenticated,service_role;