create or replace function app_private.canonical_event_scope_entity_id(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select coalesce(
    ce.authority_entity_id,
    (
      select cep.entity_id
      from public.canonical_event_participants cep
      where cep.event_id = ce.id
        and cep.entity_id is not null
      order by case when cep.role in ('authority','ordinary','affected_jurisdiction','mother_jurisdiction') then 0 else 1 end,
               cep.created_at
      limit 1
    )
  )
  from public.canonical_events ce
  where ce.id = p_event_id;
$$;

revoke all on function app_private.canonical_event_scope_entity_id(uuid) from public, anon, authenticated;
grant execute on function app_private.canonical_event_scope_entity_id(uuid) to service_role;

create or replace function public.admin_create_event_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_entity_id uuid := app_private.audit_json_uuid(payload, 'entity_id');
  v_event_id uuid;
  v_new jsonb;
begin
  if not public.current_user_has_permission('events.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear eventos' using errcode = '42501';
  end if;

  if v_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'El evento debe indicar una entidad dentro de tu alcance' using errcode = '42501';
  end if;

  if v_entity_id is not null
     and not app_private.current_user_can_manage_entity('events.create_proposal', v_entity_id) then
    raise exception 'La entidad del evento está fuera de tu alcance' using errcode = '42501';
  end if;

  v_event_id := internal.admin_create_event_draft(payload);
  select to_jsonb(ce) into v_new from public.canonical_events ce where ce.id = v_event_id;

  perform public.create_audit_log(
    auth.uid(), 'events.draft.created', 'canonical_events', v_event_id, null,
    jsonb_build_object('scope_entity_id', v_entity_id, 'record', v_new),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_event_id;
end;
$$;

create or replace function public.admin_review_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_event_id uuid := app_private.audit_json_uuid(payload, 'event_id');
  v_scope_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  if not public.current_user_has_permission('events.approve')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para revisar eventos' using errcode = '42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  if v_scope_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'El evento no tiene un alcance administrable' using errcode = '42501';
  end if;
  if v_scope_entity_id is not null
     and not app_private.current_user_can_manage_entity('events.approve', v_scope_entity_id) then
    raise exception 'El evento está fuera de tu alcance' using errcode = '42501';
  end if;

  select to_jsonb(ce) into v_old from public.canonical_events ce where ce.id = v_event_id;
  v_result := internal.admin_review_event(payload);
  select to_jsonb(ce) into v_new from public.canonical_events ce where ce.id = v_event_id;

  perform public.create_audit_log(
    auth.uid(), 'events.reviewed', 'canonical_events', v_event_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function public.admin_generate_event_action_plan(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_event_id uuid := app_private.audit_json_uuid(payload, 'event_id');
  v_scope_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  if not public.current_user_has_permission('events.update_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para preparar eventos' using errcode = '42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  if v_scope_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'El evento no tiene un alcance administrable' using errcode = '42501';
  end if;
  if v_scope_entity_id is not null
     and not app_private.current_user_can_manage_entity('events.update_proposal', v_scope_entity_id) then
    raise exception 'El evento está fuera de tu alcance' using errcode = '42501';
  end if;

  select to_jsonb(ce) into v_old from public.canonical_events ce where ce.id = v_event_id;
  v_result := internal.admin_generate_event_action_plan(payload);
  select to_jsonb(ce) into v_new from public.canonical_events ce where ce.id = v_event_id;

  perform public.create_audit_log(
    auth.uid(), 'events.plan.generated', 'canonical_events', v_event_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function public.admin_update_event_action(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_action_id uuid := app_private.audit_json_uuid(payload, 'action_id');
  v_event_id uuid;
  v_scope_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  select cea.event_id, to_jsonb(cea)
    into v_event_id, v_old
  from public.canonical_event_actions cea
  where cea.id = v_action_id;

  if not public.current_user_has_permission('events.update_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para editar acciones del evento' using errcode = '42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  if v_scope_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'El evento no tiene un alcance administrable' using errcode = '42501';
  end if;
  if v_scope_entity_id is not null
     and not app_private.current_user_can_manage_entity('events.update_proposal', v_scope_entity_id) then
    raise exception 'El evento está fuera de tu alcance' using errcode = '42501';
  end if;

  v_result := internal.admin_update_event_action(payload);
  select to_jsonb(cea) into v_new from public.canonical_event_actions cea where cea.id = v_action_id;

  perform public.create_audit_log(
    auth.uid(), 'events.action.updated', 'canonical_event_actions', v_action_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'event_id', v_event_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function public.admin_configure_event_action(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_action_id uuid := app_private.audit_json_uuid(payload, 'action_id');
  v_event_id uuid;
  v_scope_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  select cea.event_id, to_jsonb(cea)
    into v_event_id, v_old
  from public.canonical_event_actions cea
  where cea.id = v_action_id;

  if not public.current_user_has_permission('events.update_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para configurar acciones del evento' using errcode = '42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  if v_scope_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'El evento no tiene un alcance administrable' using errcode = '42501';
  end if;
  if v_scope_entity_id is not null
     and not app_private.current_user_can_manage_entity('events.update_proposal', v_scope_entity_id) then
    raise exception 'El evento está fuera de tu alcance' using errcode = '42501';
  end if;

  v_result := internal.admin_configure_event_action(payload);
  select to_jsonb(cea) into v_new from public.canonical_event_actions cea where cea.id = v_action_id;

  perform public.create_audit_log(
    auth.uid(), 'events.action.configured', 'canonical_event_actions', v_action_id, v_old,
    jsonb_build_object('scope_entity_id', v_scope_entity_id, 'event_id', v_event_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

revoke all on function internal.admin_create_event_draft(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_review_event(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_generate_event_action_plan(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_update_event_action(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_configure_event_action(jsonb) from public, anon, authenticated;

grant execute on function public.admin_create_event_draft(jsonb) to authenticated, service_role;
grant execute on function public.admin_review_event(jsonb) to authenticated, service_role;
grant execute on function public.admin_generate_event_action_plan(jsonb) to authenticated, service_role;
grant execute on function public.admin_update_event_action(jsonb) to authenticated, service_role;
grant execute on function public.admin_configure_event_action(jsonb) to authenticated, service_role;
