create or replace function public.admin_save_structure_template(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_diocese_id uuid := app_private.audit_json_uuid(payload, 'diocese_id');
  v_existing_id uuid := app_private.audit_json_uuid(payload, 'id');
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
  v_id uuid;
begin
  if v_diocese_id is null or not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para configurar estructuras en esta diócesis' using errcode = '42501';
  end if;
  if v_existing_id is not null then
    select to_jsonb(st) into v_old from public.structure_templates st where st.id = v_existing_id;
  end if;
  v_result := internal.admin_save_structure_template(payload);
  v_id := app_private.audit_json_uuid(v_result, 'id');
  select to_jsonb(st) into v_new from public.structure_templates st where st.id = v_id;
  perform public.create_audit_log(
    auth.uid(), 'structures.template.saved', 'structure_templates', v_id, v_old,
    jsonb_build_object('scope_entity_id', v_diocese_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );
  return v_result;
end;
$$;

create or replace function public.admin_save_structure_level(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_template_id uuid := app_private.audit_json_uuid(payload, 'template_id');
  v_existing_id uuid := app_private.audit_json_uuid(payload, 'id');
  v_diocese_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
  v_id uuid;
begin
  select st.diocese_id into v_diocese_id from public.structure_templates st where st.id = v_template_id;
  if v_diocese_id is null or not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para configurar niveles en esta diócesis' using errcode = '42501';
  end if;
  if v_existing_id is not null then
    select to_jsonb(sl) into v_old from public.structure_levels sl where sl.id = v_existing_id;
  end if;
  v_result := internal.admin_save_structure_level(payload);
  v_id := app_private.audit_json_uuid(v_result, 'id');
  select to_jsonb(sl) into v_new from public.structure_levels sl where sl.id = v_id;
  perform public.create_audit_log(
    auth.uid(), 'structures.level.saved', 'structure_levels', v_id, v_old,
    jsonb_build_object('scope_entity_id', v_diocese_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );
  return v_result;
end;
$$;

create or replace function public.admin_save_structure_node(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_template_id uuid := app_private.audit_json_uuid(payload, 'template_id');
  v_existing_id uuid := app_private.audit_json_uuid(payload, 'id');
  v_diocese_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
  v_id uuid;
begin
  select st.diocese_id into v_diocese_id from public.structure_templates st where st.id = v_template_id;
  if v_diocese_id is null or not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para modificar nodos en esta diócesis' using errcode = '42501';
  end if;
  if v_existing_id is not null then
    select to_jsonb(sn) into v_old from public.structure_nodes sn where sn.id = v_existing_id;
  end if;
  v_result := internal.admin_save_structure_node(payload);
  v_id := app_private.audit_json_uuid(v_result, 'id');
  select to_jsonb(sn) into v_new from public.structure_nodes sn where sn.id = v_id;
  perform public.create_audit_log(
    auth.uid(), 'structures.node.saved', 'structure_nodes', v_id, v_old,
    jsonb_build_object('scope_entity_id', v_diocese_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );
  return v_result;
end;
$$;

revoke all on function internal.admin_save_structure_template(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_save_structure_level(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_save_structure_node(jsonb) from public, anon, authenticated;

grant execute on function public.admin_save_structure_template(jsonb) to authenticated, service_role;
grant execute on function public.admin_save_structure_level(jsonb) to authenticated, service_role;
grant execute on function public.admin_save_structure_node(jsonb) to authenticated, service_role;
