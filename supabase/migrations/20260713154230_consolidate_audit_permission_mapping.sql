create or replace function app_private.audit_permission_for_action(p_action text)
returns text
language sql
immutable
set search_path = 'pg_catalog', 'pg_temp'
as $$
  select case
    when p_action = 'import.batch.prepared' or p_action like 'import.row.%' then 'imports.prepare'
    when p_action = 'import.batch.reviewed' then 'imports.review'
    when p_action like 'import.%' then 'imports.apply'
    when p_action in ('people.person.created','people.person.updated') then 'people.create_proposal'
    when p_action = 'people.person.deceased' then 'people.update_proposal'
    when p_action = 'entities.entity.created' then 'entities.create_proposal'
    when p_action = 'appointments.assignment.created' then 'appointments.create_proposal'
    when p_action like 'structures.%' then 'structures.manage'
    when p_action = 'events.draft.created' then 'events.create_proposal'
    when p_action = 'events.reviewed' then 'events.approve'
    when p_action = 'events.updated' then 'events.update_proposal'
    when p_action like 'users.%' then 'users.manage'
    else 'audit.create'
  end;
$$;

revoke all on function app_private.audit_permission_for_action(text) from public, anon, authenticated;
grant execute on function app_private.audit_permission_for_action(text) to service_role;

create or replace function public.create_audit_log(
  p_user_id uuid,
  p_action text,
  p_target_table text,
  p_target_id uuid,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_change_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'app_private', 'pg_temp'
as $$
declare
  v_audit_id uuid;
  v_scope record;
  v_permission_key text := app_private.audit_permission_for_action(p_action);
begin
  select * into v_scope
  from app_private.resolve_audit_scope(p_target_table, p_target_id, coalesce(p_new_data, '{}'::jsonb));

  insert into public.audit_logs (
    user_id, action, target_table, target_id, old_data, new_data, change_request_id,
    scope_type, scope_entity_id, diocese_id, pastoral_area_id, pastoral_entity_id,
    permission_key, outcome
  ) values (
    p_user_id, p_action, p_target_table, p_target_id, p_old_data, p_new_data, p_change_request_id,
    v_scope.resolved_scope_type, v_scope.resolved_scope_entity_id, v_scope.resolved_diocese_id,
    v_scope.resolved_pastoral_area_id, v_scope.resolved_pastoral_entity_id,
    v_permission_key, 'success'
  ) returning id into v_audit_id;

  return v_audit_id;
end;
$$;

revoke all on function public.create_audit_log(uuid, text, text, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_audit_log(uuid, text, text, uuid, jsonb, jsonb, uuid) to service_role;

create or replace function public.admin_write_audit_log(
  p_action text,
  p_target_table text default null,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_log_id uuid;
  v_action text := nullif(btrim(p_action), '');
  v_target_table text := coalesce(nullif(btrim(p_target_table), ''), 'administrative_action');
  v_permission_key text;
  v_scope record;
  v_scope_allowed boolean := false;
begin
  if v_actor_id is null then
    raise exception 'No autenticado para registrar auditoría.' using errcode = '42501';
  end if;
  if v_action is null then
    raise exception 'La acción de auditoría es obligatoria.' using errcode = '22023';
  end if;

  v_permission_key := app_private.audit_permission_for_action(v_action);

  if not app_private.current_user_has_permission(v_permission_key)
     and not app_private.current_user_is_super_or_national() then
    raise exception 'No autorizado para registrar esta operación de auditoría.' using errcode = '42501';
  end if;

  select * into v_scope
  from app_private.resolve_audit_scope(v_target_table, p_target_id, coalesce(p_metadata, '{}'::jsonb));

  if app_private.current_user_is_super_or_national() then
    v_scope_allowed := true;
  elsif v_scope.resolved_scope_entity_id is not null then
    v_scope_allowed := app_private.current_user_can_manage_entity(v_permission_key, v_scope.resolved_scope_entity_id);
  elsif v_scope.resolved_pastoral_entity_id is not null then
    v_scope_allowed := app_private.current_user_has_scope_access(
      'pastoral_entity', v_scope.resolved_pastoral_entity_id,
      v_scope.resolved_diocese_id, v_scope.resolved_pastoral_area_id, v_scope.resolved_pastoral_entity_id
    );
  elsif v_scope.resolved_pastoral_area_id is not null then
    v_scope_allowed := app_private.current_user_has_scope_access(
      'pastoral_area', v_scope.resolved_pastoral_area_id,
      v_scope.resolved_diocese_id, v_scope.resolved_pastoral_area_id, null
    );
  end if;

  if not v_scope_allowed then
    raise exception 'La operación de auditoría está fuera de tu alcance.' using errcode = '42501';
  end if;

  insert into public.audit_logs (
    user_id, action, target_table, target_id, new_data,
    scope_type, scope_entity_id, diocese_id, pastoral_area_id, pastoral_entity_id,
    permission_key, outcome
  ) values (
    v_actor_id, v_action, v_target_table, p_target_id, coalesce(p_metadata, '{}'::jsonb),
    v_scope.resolved_scope_type, v_scope.resolved_scope_entity_id, v_scope.resolved_diocese_id,
    v_scope.resolved_pastoral_area_id, v_scope.resolved_pastoral_entity_id,
    v_permission_key, 'success'
  ) returning id into v_log_id;

  return v_log_id;
end;
$$;

revoke all on function public.admin_write_audit_log(text, text, uuid, jsonb) from public, anon;
grant execute on function public.admin_write_audit_log(text, text, uuid, jsonb) to authenticated, service_role;
