-- Separate event review, approval and application into explicit contracts.
-- Approval only changes event workflow metadata and action readiness; it never
-- mutates entities, relationships, structure nodes or organization units.

create or replace function internal.get_event_approval_readiness(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public','internal','pg_temp'
as $function$
  with event_data as (
    select ce.id, ce.status, ce.effective_date, ce.verification_status,
           ce.source_name_text, ce.source_checked_at, cet.applies_to
    from public.canonical_events ce
    join public.canonical_event_types cet on cet.id = ce.event_type_id
    where ce.id = p_event_id
  ), action_counts as (
    select
      count(*)::integer as action_count,
      count(*) filter (where status = 'failed')::integer as failed_count,
      count(*) filter (where action_type_key = 'manual_relationship_review')::integer as manual_review_count
    from public.canonical_event_actions
    where event_id = p_event_id
  )
  select jsonb_build_object(
    'event_exists', e.id is not null,
    'event_status', e.status,
    'applies_to', e.applies_to,
    'has_effective_date', e.effective_date is not null,
    'has_valid_verification', e.verification_status <> 'verified'
      or (e.source_name_text is not null and e.source_checked_at is not null),
    'action_count', a.action_count,
    'failed_count', a.failed_count,
    'manual_review_count', a.manual_review_count,
    'can_approve', e.id is not null
      and e.status = 'pending_review'
      and e.effective_date is not null
      and (e.verification_status <> 'verified'
        or (e.source_name_text is not null and e.source_checked_at is not null))
      and (
        e.applies_to <> 'organization_unit'
        or (a.action_count > 0 and a.failed_count = 0 and a.manual_review_count = 0)
      ),
    'approval_does_not_apply_state', true
  )
  from event_data e
  cross join action_counts a;
$function$;

revoke all on function internal.get_event_approval_readiness(uuid) from public, anon, authenticated;

create or replace function internal.admin_approve_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','internal','auth','pg_temp'
as $function$
declare
  v_event_id uuid := nullif(payload->>'event_id','')::uuid;
  v_note text := nullif(payload->>'review_note','');
  v_readiness jsonb;
begin
  if not internal.current_user_has_admin_role() then
    raise exception 'not_authorized';
  end if;

  select internal.get_event_approval_readiness(v_event_id) into v_readiness;
  if not coalesce((v_readiness->>'event_exists')::boolean, false) then
    raise exception 'event_not_found';
  end if;
  if not coalesce((v_readiness->>'can_approve')::boolean, false) then
    raise exception 'event_not_ready_for_approval';
  end if;

  -- Readiness is workflow metadata only. Planned organizational actions become
  -- ready, but no current-state table is changed here.
  update public.canonical_event_actions
  set status = 'ready', updated_at = now()
  where event_id = v_event_id and status = 'planned';

  update public.canonical_events
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now(),
      notes_json = coalesce(notes_json,'{}'::jsonb) || jsonb_build_object(
        'review_note', v_note,
        'review_action', 'approve',
        'reviewed_at', now()
      )
  where id = v_event_id and status = 'pending_review';

  if not found then raise exception 'event_not_pending_review'; end if;

  return jsonb_build_object(
    'event_id', v_event_id,
    'status', 'approved',
    'applies_to', v_readiness->>'applies_to',
    'application_required', true,
    'state_applied', false
  );
end;
$function$;

revoke all on function internal.admin_approve_event(jsonb) from public, anon, authenticated;

create or replace function app_private.rpc_definer__admin_approve_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','internal','app_private','auth','pg_temp'
as $function$
declare
  v_event_id uuid := app_private.audit_json_uuid(payload,'event_id');
  v_scope_entity_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_result jsonb;
begin
  if not public.current_user_has_permission('events.approve')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para aprobar eventos' using errcode='42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  if v_scope_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'El evento no tiene un alcance administrable' using errcode='42501';
  end if;
  if v_scope_entity_id is not null
     and not app_private.current_user_can_manage_entity('events.approve',v_scope_entity_id) then
    raise exception 'El evento está fuera de tu alcance' using errcode='42501';
  end if;

  select to_jsonb(ce) into v_old from public.canonical_events ce where ce.id=v_event_id;
  v_result := internal.admin_approve_event(payload);
  select to_jsonb(ce) into v_new from public.canonical_events ce where ce.id=v_event_id;

  perform public.create_audit_log(
    auth.uid(),'events.approved','canonical_events',v_event_id,v_old,
    jsonb_build_object('scope_entity_id',v_scope_entity_id,'record',v_new,'result',v_result),
    app_private.audit_json_uuid(payload,'change_request_id')
  );

  return v_result;
end;
$function$;

revoke all on function app_private.rpc_definer__admin_approve_event(jsonb) from public, anon, authenticated;

create or replace function public.admin_approve_event(payload jsonb)
returns jsonb
language sql
set search_path to 'pg_catalog','public','app_private','auth','pg_temp'
as $function$
  select app_private.rpc_definer__admin_approve_event(payload)
$function$;

revoke all on function public.admin_approve_event(jsonb) from public, anon;
grant execute on function public.admin_approve_event(jsonb) to authenticated;

-- The generic review contract no longer approves. It only returns to draft or
-- cancels; application remains exclusively in admin_apply_* contracts.
create or replace function internal.admin_review_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','internal','auth','pg_temp'
as $function$
declare
  v_event_id uuid := nullif(payload->>'event_id','')::uuid;
  v_action text := nullif(payload->>'action','');
  v_status text;
  v_event record;
  v_note text := nullif(payload->>'review_note','');
begin
  if not internal.current_user_has_admin_role() then raise exception 'not_authorized'; end if;

  select ce.*,cet.applies_to into v_event
  from public.canonical_events ce
  join public.canonical_event_types cet on cet.id=ce.event_type_id
  where ce.id=v_event_id for update;
  if not found then raise exception 'event_not_found'; end if;

  if v_action='cancel' then
    if v_event.status not in ('draft','pending_review','approved') then raise exception 'event_cannot_be_cancelled'; end if;
    v_status:='cancelled';
  elsif v_action='return_to_draft' then
    if v_event.status<>'pending_review' then raise exception 'event_not_pending_review'; end if;
    v_status:='draft';
  elsif v_action='approve' then
    raise exception 'use_admin_approve_event';
  else
    raise exception 'invalid_review_action';
  end if;

  update public.canonical_events
  set status=v_status,updated_at=now(),notes_json=coalesce(notes_json,'{}'::jsonb)||jsonb_build_object(
    'review_note',v_note,'review_action',v_action,'reviewed_at',now()
  )
  where id=v_event_id;

  return jsonb_build_object('event_id',v_event_id,'status',v_status,'applies_to',v_event.applies_to,'state_applied',false);
end;
$function$;
