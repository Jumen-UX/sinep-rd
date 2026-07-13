create or replace function public.admin_save_ecclesiastical_entity(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  clean_payload jsonb;
  save_result jsonb;
  v_parent_id uuid := app_private.audit_json_uuid(payload, 'parent_entity_id');
  v_entity_id uuid;
  v_new jsonb;
begin
  if not public.current_user_has_permission('entities.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear entidades' using errcode = '42501';
  end if;

  if v_parent_id is null and not public.current_user_is_super_or_national() then
    raise exception 'Debes seleccionar una entidad superior dentro de tu alcance' using errcode = '42501';
  end if;

  if v_parent_id is not null
     and not app_private.current_user_can_manage_entity('entities.create_proposal', v_parent_id) then
    raise exception 'La entidad superior está fuera de tu alcance' using errcode = '42501';
  end if;

  clean_payload := payload
    - 'structure_diocese_id'
    - 'structure_template_id'
    - 'structure_parent_node_id'
    - 'structure_parent_level_id'
    - 'structure_parent_level_key'
    - 'structure_linked_entity_id'
    - 'structure_parent_path';

  save_result := internal.admin_save_ecclesiastical_entity(clean_payload);
  v_entity_id := app_private.audit_json_uuid(save_result, 'entity_id');
  select to_jsonb(ee) into v_new from public.ecclesiastical_entities ee where ee.id = v_entity_id;

  perform public.create_audit_log(
    auth.uid(), 'entities.entity.created', 'ecclesiastical_entities', v_entity_id, null,
    jsonb_build_object('scope_entity_id', coalesce(v_parent_id, v_entity_id), 'record', v_new, 'result', save_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return save_result || jsonb_build_object(
    'structure_context_received', jsonb_build_object(
      'diocese_id', payload ->> 'structure_diocese_id',
      'template_id', payload ->> 'structure_template_id',
      'parent_node_id', payload ->> 'structure_parent_node_id',
      'parent_level_id', payload ->> 'structure_parent_level_id',
      'parent_level_key', payload ->> 'structure_parent_level_key',
      'linked_entity_id', payload ->> 'structure_linked_entity_id',
      'path', payload ->> 'structure_parent_path'
    )
  );
end;
$$;

revoke all on function internal.admin_save_ecclesiastical_entity(jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_ecclesiastical_entity(jsonb) to authenticated, service_role;
