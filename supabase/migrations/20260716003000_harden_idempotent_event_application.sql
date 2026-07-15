create or replace function internal.admin_apply_organization_unit_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $function$
declare
  v_event_id uuid := nullif(payload->>'event_id', '')::uuid;
  v_event record;
  v_action record;
  v_unit_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_save_payload jsonb;
  v_applied_count integer := 0;
  v_dependency_id uuid;
begin
  if not internal.current_user_has_admin_role() then
    raise exception 'not_authorized';
  end if;

  select ce.*, cet.applies_to, cet.key as event_type_key
  into v_event
  from public.canonical_events ce
  join public.canonical_event_types cet on cet.id = ce.event_type_id
  where ce.id = v_event_id
  for update;

  if not found then
    raise exception 'event_not_found';
  end if;

  if v_event.applies_to <> 'organization_unit' then
    raise exception 'event_is_not_organizational';
  end if;

  if v_event.status = 'applied' then
    return jsonb_build_object(
      'event_id', v_event_id,
      'status', 'applied',
      'organization_unit_id', nullif(v_event.notes_json #>> '{organization_unit_application,organization_unit_id}', '')::uuid,
      'applied_action_count', (
        select count(*)
        from public.canonical_event_actions
        where event_id = v_event_id and status = 'applied'
      ),
      'idempotent_replay', true,
      'applied_at', v_event.applied_at
    );
  end if;

  if v_event.status <> 'approved' then
    raise exception 'event_not_approved';
  end if;

  if not exists (
    select 1 from public.canonical_event_actions where event_id = v_event_id
  ) then
    raise exception 'event_action_plan_required';
  end if;

  if exists (
    select 1
    from public.canonical_event_actions
    where event_id = v_event_id and status in ('planned', 'failed')
  ) then
    raise exception 'event_actions_not_ready';
  end if;

  if exists (
    select 1
    from public.canonical_event_actions action
    cross join lateral jsonb_array_elements_text(
      coalesce(action.payload->'depends_on_action_ids', '[]'::jsonb)
    ) dependency(id)
    where action.event_id = v_event_id
      and not exists (
        select 1
        from public.canonical_event_actions required_action
        where required_action.id = dependency.id::uuid
          and required_action.event_id = v_event_id
      )
  ) then
    raise exception 'event_action_dependency_missing';
  end if;

  for v_action in
    select *
    from public.canonical_event_actions
    where event_id = v_event_id and status = 'ready'
    order by sort_order, id
    for update
  loop
    for v_dependency_id in
      select dependency.id::uuid
      from jsonb_array_elements_text(
        coalesce(v_action.payload->'depends_on_action_ids', '[]'::jsonb)
      ) dependency(id)
    loop
      if not exists (
        select 1
        from public.canonical_event_actions required_action
        where required_action.id = v_dependency_id
          and required_action.event_id = v_event_id
          and required_action.status in ('applied', 'skipped')
      ) then
        raise exception 'event_action_dependency_not_applied';
      end if;
    end loop;

    v_unit_id := v_action.subject_organization_unit_id;
    v_before := null;
    v_after := null;

    if v_action.action_type_key in ('validate_event', 'attach_source_reference', 'no_state_change') then
      null;
    elsif v_action.action_type_key = 'create_organization_unit' then
      v_after := internal.admin_save_organization_unit(v_action.payload);
      v_unit_id := nullif(v_after->>'id', '')::uuid;

      insert into public.canonical_event_participants(
        event_id,
        organization_unit_id,
        role,
        before_state,
        after_state
      )
      values(v_event_id, v_unit_id, 'created_unit', null, v_after)
      on conflict do nothing;

      update public.canonical_event_actions
      set subject_organization_unit_id = v_unit_id,
          payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('result', v_after)
      where id = v_action.id;
    else
      if v_unit_id is null then
        raise exception 'organization_unit_action_target_required';
      end if;

      select to_jsonb(ou)
      into v_before
      from public.organization_units ou
      where ou.id = v_unit_id
      for update;

      if v_before is null then
        raise exception 'organization_unit_not_found';
      end if;

      if v_action.action_type_key = 'move_organization_unit' then
        v_save_payload := jsonb_build_object(
          'id', v_unit_id,
          'parent_unit_id', v_action.target_organization_unit_id
        );
      elsif v_action.action_type_key = 'update_organization_unit_status' then
        v_save_payload := jsonb_build_object(
          'id', v_unit_id,
          'status', v_action.payload->>'new_status',
          'is_current', coalesce(
            nullif(v_action.payload->>'is_current', '')::boolean,
            (v_action.payload->>'new_status') not in ('inactive', 'archived')
          )
        );
      elsif v_action.action_type_key = 'publish_organization_unit' then
        if coalesce(v_action.payload->>'new_visibility', '') not in ('public', 'internal', 'private') then
          raise exception 'invalid_organization_unit_visibility';
        end if;
        if coalesce(v_action.payload->>'new_status', '') not in ('active', 'inactive', 'archived', 'draft') then
          raise exception 'invalid_organization_unit_status';
        end if;
        v_save_payload := jsonb_build_object(
          'id', v_unit_id,
          'visibility', v_action.payload->>'new_visibility',
          'status', v_action.payload->>'new_status',
          'is_current', (v_action.payload->>'new_status') not in ('inactive', 'archived')
        );
      elsif v_action.action_type_key = 'update_organization_unit_validity' then
        v_save_payload := jsonb_build_object(
          'id', v_unit_id,
          'valid_from', v_action.payload->>'valid_from',
          'valid_to', v_action.payload->>'valid_to'
        );
      else
        raise exception 'unsupported_organization_unit_action';
      end if;

      v_after := internal.admin_save_organization_unit(v_save_payload);

      update public.canonical_event_participants
      set after_state = v_after
      where event_id = v_event_id and organization_unit_id = v_unit_id;

      update public.canonical_event_actions
      set payload = coalesce(payload, '{}'::jsonb)
        || jsonb_build_object('before_state', v_before, 'after_state', v_after)
      where id = v_action.id;
    end if;

    update public.canonical_event_actions
    set status = 'applied',
        applied_by = auth.uid(),
        applied_at = now(),
        updated_at = now()
    where id = v_action.id;

    v_applied_count := v_applied_count + 1;
  end loop;

  update public.canonical_events
  set status = 'applied',
      applied_by = auth.uid(),
      applied_at = now(),
      updated_at = now(),
      notes_json = coalesce(notes_json, '{}'::jsonb) || jsonb_build_object(
        'organization_unit_application',
        jsonb_build_object(
          'applied_at', now(),
          'applied_by', auth.uid(),
          'action_count', v_applied_count,
          'organization_unit_id', v_unit_id
        )
      )
  where id = v_event_id;

  return jsonb_build_object(
    'event_id', v_event_id,
    'status', 'applied',
    'organization_unit_id', v_unit_id,
    'applied_action_count', v_applied_count,
    'idempotent_replay', false
  );
end;
$function$;

create or replace function app_private.rpc_definer__admin_apply_organization_unit_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $function$
declare
  v_event_id uuid := app_private.audit_json_uuid(payload, 'event_id');
  v_scope_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
  v_action text;
begin
  if not public.current_user_has_permission('events.apply')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para aplicar eventos' using errcode = '42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  if v_scope_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'El evento no tiene un alcance administrable' using errcode = '42501';
  end if;
  if v_scope_entity_id is not null
     and not app_private.current_user_can_manage_entity('events.apply', v_scope_entity_id) then
    raise exception 'El evento está fuera de tu alcance' using errcode = '42501';
  end if;

  select to_jsonb(ce) into v_old
  from public.canonical_events ce
  where ce.id = v_event_id;

  v_result := internal.admin_apply_organization_unit_event(payload);

  select to_jsonb(ce) into v_new
  from public.canonical_events ce
  where ce.id = v_event_id;

  v_action := case
    when coalesce((v_result->>'idempotent_replay')::boolean, false)
      then 'events.organization_unit.apply_replayed'
    else 'events.organization_unit.applied'
  end;

  perform public.create_audit_log(
    auth.uid(),
    v_action,
    'canonical_events',
    v_event_id,
    v_old,
    jsonb_build_object(
      'scope_entity_id', v_scope_entity_id,
      'organization_unit_id', nullif(v_result->>'organization_unit_id', '')::uuid,
      'record', v_new,
      'result', v_result
    ),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$function$;

revoke all on function internal.admin_apply_organization_unit_event(jsonb) from public, anon, authenticated;
revoke all on function app_private.rpc_definer__admin_apply_organization_unit_event(jsonb) from public, anon, authenticated;
grant execute on function public.admin_apply_organization_unit_event(jsonb) to authenticated;
