create table if not exists public.canonical_event_revisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.canonical_events(id) on delete restrict,
  revision_number integer not null,
  before_state jsonb not null,
  after_state jsonb not null,
  changed_fields text[] not null default '{}',
  change_reason text not null,
  source_name text,
  source_url text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  constraint canonical_event_revisions_reason_required check (length(trim(change_reason)) > 0),
  constraint canonical_event_revisions_unique_number unique(event_id, revision_number)
);

create index if not exists canonical_event_revisions_event_changed_idx
  on public.canonical_event_revisions(event_id, changed_at desc);

alter table public.canonical_event_revisions enable row level security;
revoke all on table public.canonical_event_revisions from public, anon;
grant select on table public.canonical_event_revisions to authenticated;

create policy canonical_event_revisions_authenticated_read
  on public.canonical_event_revisions
  for select
  to authenticated
  using (true);

create or replace function internal.protect_applied_canonical_event_history()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if tg_op = 'DELETE' and old.status = 'applied' then
    raise exception 'applied_event_cannot_be_deleted';
  end if;

  if tg_op = 'UPDATE' and old.status = 'applied'
     and coalesce(current_setting('app.event_correction_context', true), '') <> 'on'
     and (
       new.event_type_id is distinct from old.event_type_id or
       new.title is distinct from old.title or
       new.description is distinct from old.description or
       new.event_date is distinct from old.event_date or
       new.effective_date is distinct from old.effective_date or
       new.authority_entity_id is distinct from old.authority_entity_id or
       new.status is distinct from old.status or
       new.source_name_text is distinct from old.source_name_text or
       new.source_url_text is distinct from old.source_url_text or
       new.source_checked_at is distinct from old.source_checked_at or
       new.verification_status is distinct from old.verification_status or
       new.evidence_status is distinct from old.evidence_status
     ) then
    raise exception 'applied_event_requires_audited_correction';
  end if;

  return case when tg_op='DELETE' then old else new end;
end;
$function$;

create or replace function internal.admin_correct_canonical_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','internal','auth','pg_temp'
as $function$
declare
  v_event_id uuid := nullif(payload->>'event_id','')::uuid;
  v_event public.canonical_events%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_reason text := nullif(trim(payload->>'change_reason'),'');
  v_source_name text := nullif(trim(payload->>'source_name'),'');
  v_source_url text := nullif(trim(payload->>'source_url'),'');
  v_revision_number integer;
  v_changed_fields text[] := '{}';
  v_patch jsonb := coalesce(payload->'changes','{}'::jsonb);
begin
  if not internal.current_user_has_admin_role() then
    raise exception 'not_authorized';
  end if;
  if v_event_id is null then raise exception 'event_id_required'; end if;
  if v_reason is null then raise exception 'change_reason_required'; end if;
  if jsonb_typeof(v_patch) <> 'object' then raise exception 'changes_must_be_object'; end if;
  if v_patch = '{}'::jsonb then raise exception 'changes_required'; end if;
  if exists (
    select 1 from jsonb_object_keys(v_patch) k
    where k not in (
      'title','description','event_date','effective_date','authority_entity_id',
      'source_name_text','source_url_text','source_checked_at',
      'verification_status','evidence_status'
    )
  ) then
    raise exception 'unsupported_event_correction_field';
  end if;

  select * into v_event
  from public.canonical_events
  where id = v_event_id
  for update;

  if not found then raise exception 'event_not_found'; end if;

  v_before := to_jsonb(v_event);
  select coalesce(array_agg(key order by key),'{}'::text[])
    into v_changed_fields
  from jsonb_object_keys(v_patch) key;

  perform set_config('app.event_correction_context','on',true);

  update public.canonical_events
  set title = case when v_patch ? 'title' then nullif(trim(v_patch->>'title'),'') else title end,
      description = case when v_patch ? 'description' then nullif(v_patch->>'description','') else description end,
      event_date = case when v_patch ? 'event_date' then nullif(v_patch->>'event_date','')::date else event_date end,
      effective_date = case when v_patch ? 'effective_date' then nullif(v_patch->>'effective_date','')::date else effective_date end,
      authority_entity_id = case when v_patch ? 'authority_entity_id' then nullif(v_patch->>'authority_entity_id','')::uuid else authority_entity_id end,
      source_name_text = case when v_patch ? 'source_name_text' then nullif(trim(v_patch->>'source_name_text'),'') else source_name_text end,
      source_url_text = case when v_patch ? 'source_url_text' then nullif(trim(v_patch->>'source_url_text'),'') else source_url_text end,
      source_checked_at = case when v_patch ? 'source_checked_at' then nullif(v_patch->>'source_checked_at','')::date else source_checked_at end,
      verification_status = case when v_patch ? 'verification_status' then v_patch->>'verification_status' else verification_status end,
      evidence_status = case when v_patch ? 'evidence_status' then v_patch->>'evidence_status' else evidence_status end,
      updated_at = now()
  where id = v_event_id
  returning to_jsonb(canonical_events.*) into v_after;

  if v_after->>'title' is null then raise exception 'title_required'; end if;
  if (v_after->>'verification_status') = 'verified'
     and (nullif(v_after->>'source_name_text','') is null or nullif(v_after->>'source_checked_at','') is null) then
    raise exception 'verified_source_requires_name_and_date';
  end if;

  select coalesce(max(revision_number),0)+1
    into v_revision_number
  from public.canonical_event_revisions
  where event_id = v_event_id;

  insert into public.canonical_event_revisions(
    event_id, revision_number, before_state, after_state, changed_fields,
    change_reason, source_name, source_url, changed_by
  ) values (
    v_event_id, v_revision_number, v_before, v_after, v_changed_fields,
    v_reason, v_source_name, v_source_url, auth.uid()
  );

  return jsonb_build_object(
    'event_id', v_event_id,
    'revision_number', v_revision_number,
    'changed_fields', to_jsonb(v_changed_fields),
    'before_state', v_before,
    'after_state', v_after
  );
end;
$function$;

create or replace function app_private.rpc_definer__admin_correct_canonical_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','internal','app_private','auth','pg_temp'
as $function$
declare
  v_event_id uuid := app_private.audit_json_uuid(payload,'event_id');
  v_scope_entity_id uuid;
  v_result jsonb;
begin
  if not public.current_user_has_permission('events.approve')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para corregir eventos' using errcode='42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);
  if v_scope_entity_id is not null
     and not app_private.current_user_can_manage_entity('events.approve',v_scope_entity_id) then
    raise exception 'El evento está fuera de tu alcance' using errcode='42501';
  end if;

  v_result := internal.admin_correct_canonical_event(payload);

  perform public.create_audit_log(
    auth.uid(),'events.corrected','canonical_events',v_event_id,
    v_result->'before_state',
    jsonb_build_object(
      'scope_entity_id',v_scope_entity_id,
      'record',v_result->'after_state',
      'revision_number',v_result->'revision_number',
      'changed_fields',v_result->'changed_fields',
      'change_reason',payload->>'change_reason'
    ),
    app_private.audit_json_uuid(payload,'change_request_id')
  );

  return v_result;
end;
$function$;

create or replace function public.admin_correct_canonical_event(payload jsonb)
returns jsonb
language sql
set search_path to 'pg_catalog','public','app_private','internal','auth','pg_temp'
as $function$
  select app_private.rpc_definer__admin_correct_canonical_event(payload)
$function$;

revoke all on function internal.admin_correct_canonical_event(jsonb) from public,anon,authenticated;
revoke all on function app_private.rpc_definer__admin_correct_canonical_event(jsonb) from public,anon,authenticated;
revoke all on function public.admin_correct_canonical_event(jsonb) from public,anon;
grant execute on function public.admin_correct_canonical_event(jsonb) to authenticated;

drop function if exists public.admin_create_compensating_event(jsonb);
drop function if exists app_private.rpc_definer__admin_create_compensating_event(jsonb);
drop function if exists internal.admin_create_compensating_event(jsonb);
drop index if exists public.canonical_events_one_active_compensation_per_event;
alter table public.canonical_events drop constraint if exists canonical_events_not_self_compensating;
alter table public.canonical_events drop constraint if exists canonical_events_correction_kind_check;
alter table public.canonical_events
  drop column if exists compensates_event_id,
  drop column if exists compensation_reason,
  drop column if exists correction_kind;
