alter table public.canonical_events
  add column if not exists compensates_event_id uuid references public.canonical_events(id),
  add column if not exists compensation_reason text,
  add column if not exists correction_kind text;

alter table public.canonical_events
  drop constraint if exists canonical_events_not_self_compensating;

alter table public.canonical_events
  add constraint canonical_events_not_self_compensating
  check (compensates_event_id is null or compensates_event_id <> id);

alter table public.canonical_events
  drop constraint if exists canonical_events_correction_kind_check;

alter table public.canonical_events
  add constraint canonical_events_correction_kind_check
  check (correction_kind is null or correction_kind in ('reversal','correction','supersession'));

create unique index if not exists canonical_events_one_active_compensation_per_event
  on public.canonical_events(compensates_event_id)
  where compensates_event_id is not null and status <> 'cancelled';

create or replace function internal.admin_create_compensating_event(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'internal', 'auth', 'pg_temp'
as $function$
declare
  v_original_id uuid := nullif(payload->>'original_event_id','')::uuid;
  v_original record;
  v_new_id uuid;
  v_reason text := nullif(trim(payload->>'reason'),'');
  v_kind text := coalesce(nullif(payload->>'correction_kind',''),'correction');
  v_title text;
begin
  if not internal.current_user_has_admin_role() then
    raise exception 'not_authorized';
  end if;

  if v_original_id is null then raise exception 'original_event_required'; end if;
  if v_reason is null then raise exception 'compensation_reason_required'; end if;
  if v_kind not in ('reversal','correction','supersession') then raise exception 'invalid_correction_kind'; end if;

  select ce.*, cet.is_compensable, cet.key as event_type_key
  into v_original
  from public.canonical_events ce
  join public.canonical_event_types cet on cet.id = ce.event_type_id
  where ce.id = v_original_id
  for share;

  if not found then raise exception 'original_event_not_found'; end if;
  if v_original.status <> 'applied' then raise exception 'original_event_not_applied'; end if;
  if not v_original.is_compensable then raise exception 'event_type_not_compensable'; end if;

  if exists (
    select 1 from public.canonical_events
    where compensates_event_id = v_original_id and status <> 'cancelled'
  ) then
    raise exception 'active_compensation_already_exists';
  end if;

  v_title := coalesce(nullif(trim(payload->>'title'),''),
    case v_kind
      when 'reversal' then 'Reversión de: '
      when 'supersession' then 'Sustitución de: '
      else 'Corrección de: '
    end || v_original.title
  );

  insert into public.canonical_events(
    event_type_id,title,description,event_date,effective_date,authority_entity_id,
    status,created_by,load_mode,evidence_status,source_name_text,source_url_text,
    source_checked_at,verification_status,notes_json,compensates_event_id,
    compensation_reason,correction_kind
  )
  values(
    v_original.event_type_id,v_title,nullif(payload->>'description',''),
    nullif(payload->>'event_date','')::date,
    coalesce(nullif(payload->>'effective_date','')::date,nullif(payload->>'event_date','')::date),
    v_original.authority_entity_id,'draft',auth.uid(),'evento_nuevo','pendiente_documento',
    nullif(trim(payload->>'source_name'),''),nullif(trim(payload->>'source_url'),''),
    nullif(payload->>'source_checked_at','')::date,'pending_review',
    jsonb_build_object('created_from','compensating_event','original_event_id',v_original_id,'raw_payload',payload),
    v_original_id,v_reason,v_kind
  )
  returning id into v_new_id;

  insert into public.canonical_event_participants(
    event_id,entity_id,organization_unit_id,role,before_state,after_state
  )
  select v_new_id,cep.entity_id,cep.organization_unit_id,cep.role,
         cep.after_state,cep.before_state
  from public.canonical_event_participants cep
  where cep.event_id = v_original_id;

  return v_new_id;
end;
$function$;

create or replace function app_private.rpc_definer__admin_create_compensating_event(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public','internal','app_private','auth','pg_temp'
as $function$
declare
  v_original_id uuid := app_private.audit_json_uuid(payload,'original_event_id');
  v_scope_entity_id uuid;
  v_result uuid;
begin
  if not public.current_user_has_permission('events.approve')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear correcciones de eventos' using errcode='42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_original_id);
  if v_scope_entity_id is not null
     and not app_private.current_user_can_manage_entity('events.approve',v_scope_entity_id) then
    raise exception 'El evento está fuera de tu alcance' using errcode='42501';
  end if;

  v_result := internal.admin_create_compensating_event(payload);

  perform public.create_audit_log(
    auth.uid(),'events.compensation.created','canonical_events',v_result,null,
    jsonb_build_object('original_event_id',v_original_id,'scope_entity_id',v_scope_entity_id,'compensating_event_id',v_result),
    app_private.audit_json_uuid(payload,'change_request_id')
  );

  return v_result;
end;
$function$;

create or replace function public.admin_create_compensating_event(payload jsonb)
returns uuid
language sql
set search_path to 'pg_catalog','public','app_private','internal','auth','pg_temp'
as $function$
  select app_private.rpc_definer__admin_create_compensating_event(payload)
$function$;

create or replace function internal.protect_applied_canonical_event_history()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if tg_op = 'DELETE' and old.status = 'applied' then
    raise exception 'applied_event_cannot_be_deleted';
  end if;

  if tg_op = 'UPDATE' and old.status = 'applied' and (
    new.event_type_id is distinct from old.event_type_id or
    new.title is distinct from old.title or
    new.description is distinct from old.description or
    new.event_date is distinct from old.event_date or
    new.effective_date is distinct from old.effective_date or
    new.authority_entity_id is distinct from old.authority_entity_id or
    new.status is distinct from old.status or
    new.compensates_event_id is distinct from old.compensates_event_id or
    new.compensation_reason is distinct from old.compensation_reason or
    new.correction_kind is distinct from old.correction_kind
  ) then
    raise exception 'applied_event_is_immutable_create_compensation';
  end if;

  return case when tg_op='DELETE' then old else new end;
end;
$function$;

drop trigger if exists protect_applied_canonical_event_history on public.canonical_events;
create trigger protect_applied_canonical_event_history
before update or delete on public.canonical_events
for each row execute function internal.protect_applied_canonical_event_history();

revoke all on function internal.admin_create_compensating_event(jsonb) from public,anon,authenticated;
revoke all on function app_private.rpc_definer__admin_create_compensating_event(jsonb) from public,anon,authenticated;
grant execute on function public.admin_create_compensating_event(jsonb) to authenticated;
