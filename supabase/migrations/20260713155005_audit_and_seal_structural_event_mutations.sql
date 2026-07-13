create or replace function app_private.structure_event_diocese_id(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select coalesce(
    st.diocese_id,
    (
      select sn.diocese_id
      from public.structure_event_nodes sen
      join public.structure_nodes sn on sn.id = sen.node_id
      where sen.event_id = se.id
        and sn.diocese_id is not null
      order by sen.created_at
      limit 1
    )
  )
  from public.structure_events se
  left join public.structure_templates st on st.id = se.template_id
  where se.id = p_event_id;
$$;

revoke all on function app_private.structure_event_diocese_id(uuid) from public, anon, authenticated;
grant execute on function app_private.structure_event_diocese_id(uuid) to service_role;

create or replace function public.admin_create_structural_evolution_event_draft(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_template_id uuid := app_private.audit_json_uuid(payload, 'template_id');
  v_node_id uuid := app_private.audit_json_uuid(payload, 'node_id');
  v_diocese_id uuid;
  v_result jsonb;
  v_event_id uuid;
  v_new jsonb;
begin
  select coalesce(
    (select st.diocese_id from public.structure_templates st where st.id = v_template_id),
    (select sn.diocese_id from public.structure_nodes sn where sn.id = v_node_id)
  ) into v_diocese_id;

  if v_diocese_id is null or not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para crear eventos estructurales en esta diócesis' using errcode = '42501';
  end if;

  v_result := internal.admin_create_structural_evolution_event_draft(payload);
  v_event_id := nullif(v_result #>> '{event,id}', '')::uuid;
  select to_jsonb(se) into v_new from public.structure_events se where se.id = v_event_id;

  perform public.create_audit_log(
    auth.uid(), 'structures.event.draft.created', 'structure_events', v_event_id, null,
    jsonb_build_object('scope_entity_id', v_diocese_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function public.admin_review_structural_evolution_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_event_id uuid := app_private.audit_json_uuid(payload, 'event_id');
  v_diocese_id uuid := app_private.structure_event_diocese_id(v_event_id);
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  if v_diocese_id is null or not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para revisar este evento estructural' using errcode = '42501';
  end if;

  select to_jsonb(se) into v_old from public.structure_events se where se.id = v_event_id;
  v_result := internal.admin_review_structural_evolution_event(payload);
  select to_jsonb(se) into v_new from public.structure_events se where se.id = v_event_id;

  perform public.create_audit_log(
    auth.uid(), 'structures.event.reviewed', 'structure_events', v_event_id, v_old,
    jsonb_build_object('scope_entity_id', v_diocese_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function public.admin_generate_structural_application_plan(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_event_id uuid := app_private.audit_json_uuid(payload, 'event_id');
  v_diocese_id uuid := app_private.structure_event_diocese_id(v_event_id);
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  if v_diocese_id is null or not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para preparar este evento estructural' using errcode = '42501';
  end if;

  select to_jsonb(se) into v_old from public.structure_events se where se.id = v_event_id;
  v_result := internal.admin_generate_structural_application_plan(payload);
  select to_jsonb(se) into v_new from public.structure_events se where se.id = v_event_id;

  perform public.create_audit_log(
    auth.uid(), 'structures.event.plan.generated', 'structure_events', v_event_id, v_old,
    jsonb_build_object('scope_entity_id', v_diocese_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function public.admin_update_structural_event_action(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_action_id uuid := app_private.audit_json_uuid(payload, 'action_id');
  v_event_id uuid;
  v_diocese_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  select sea.event_id, to_jsonb(sea)
    into v_event_id, v_old
  from public.structure_event_actions sea
  where sea.id = v_action_id;

  v_diocese_id := app_private.structure_event_diocese_id(v_event_id);
  if v_diocese_id is null or not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para editar esta acción estructural' using errcode = '42501';
  end if;

  v_result := internal.admin_update_structural_event_action(payload);
  select to_jsonb(sea) into v_new from public.structure_event_actions sea where sea.id = v_action_id;

  perform public.create_audit_log(
    auth.uid(), 'structures.event.action.updated', 'structure_event_actions', v_action_id, v_old,
    jsonb_build_object('scope_entity_id', v_diocese_id, 'event_id', v_event_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function public.admin_configure_structural_event_action(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_action_id uuid := app_private.audit_json_uuid(payload, 'action_id');
  v_event_id uuid;
  v_diocese_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  select sea.event_id, to_jsonb(sea)
    into v_event_id, v_old
  from public.structure_event_actions sea
  where sea.id = v_action_id;

  v_diocese_id := app_private.structure_event_diocese_id(v_event_id);
  if v_diocese_id is null or not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para configurar esta acción estructural' using errcode = '42501';
  end if;

  v_result := internal.admin_configure_structural_event_action(payload);
  select to_jsonb(sea) into v_new from public.structure_event_actions sea where sea.id = v_action_id;

  perform public.create_audit_log(
    auth.uid(), 'structures.event.action.configured', 'structure_event_actions', v_action_id, v_old,
    jsonb_build_object('scope_entity_id', v_diocese_id, 'event_id', v_event_id, 'record', v_new, 'result', v_result),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

revoke all on function internal.admin_create_structural_evolution_event_draft(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_review_structural_evolution_event(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_generate_structural_application_plan(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_update_structural_event_action(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_configure_structural_event_action(jsonb) from public, anon, authenticated;

grant execute on function public.admin_create_structural_evolution_event_draft(jsonb) to authenticated, service_role;
grant execute on function public.admin_review_structural_evolution_event(jsonb) to authenticated, service_role;
grant execute on function public.admin_generate_structural_application_plan(jsonb) to authenticated, service_role;
grant execute on function public.admin_update_structural_event_action(jsonb) to authenticated, service_role;
grant execute on function public.admin_configure_structural_event_action(jsonb) to authenticated, service_role;
