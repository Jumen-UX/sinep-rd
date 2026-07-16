begin;

create table if not exists public.import_batch_reversals (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null unique references public.import_batches(id) on delete restrict,
  status text not null check (status in ('requested','blocked','completed')),
  reason text not null check (length(trim(reason)) > 0),
  reversal_plan jsonb not null default '{}'::jsonb,
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  processed_by uuid references auth.users(id),
  processed_at timestamptz,
  audit_log_id uuid references public.audit_logs(id),
  updated_at timestamptz not null default now()
);

alter table public.import_batch_reversals enable row level security;
revoke all on table public.import_batch_reversals from public,anon;
grant select on table public.import_batch_reversals to authenticated;

create or replace function app_private.build_import_reversal_plan(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,app_private,auth,pg_temp
as $$
declare
  v_change public.import_batch_changes%rowtype;
  v_items jsonb:='[]'::jsonb;
  v_action text;
  v_blocked integer:=0;
  v_reversible integer:=0;
  v_event_status text;
begin
  for v_change in
    select * from public.import_batch_changes where batch_id=p_batch_id order by recorded_at desc,id desc
  loop
    v_action:='blocked_manual_canonical_resolution';
    if v_change.operation='noop' then
      v_action:='record_only';
    elsif v_change.operation='update' and v_change.target_table='canonical_events' then
      v_action:='restore_event_record';
    elsif v_change.operation='create' and v_change.target_table='canonical_events' then
      select status into v_event_status from public.canonical_events where id=v_change.target_record_id;
      if v_event_status in ('draft','pending_review') then v_action:='retire_unapplied_event'; end if;
    end if;

    if v_action='blocked_manual_canonical_resolution' then v_blocked:=v_blocked+1; else v_reversible:=v_reversible+1; end if;
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'change_id',v_change.id,'row_id',v_change.row_id,'operation',v_change.operation,
      'target_table',v_change.target_table,'target_record_id',v_change.target_record_id,
      'action',v_action
    ));
  end loop;

  return jsonb_build_object(
    'batch_id',p_batch_id,'items',v_items,'reversible_count',v_reversible,
    'blocked_count',v_blocked,'can_reverse',v_blocked=0 and jsonb_array_length(v_items)>0
  );
end;
$$;

create or replace function app_private.admin_reverse_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,app_private,internal,auth,pg_temp
as $$
declare
  v_actor uuid:=auth.uid();
  v_batch_id uuid:=nullif(payload->>'batch_id','')::uuid;
  v_reason text:=nullif(trim(payload->>'reason'),'');
  v_batch public.import_batches%rowtype;
  v_change public.import_batch_changes%rowtype;
  v_plan jsonb;
  v_audit uuid;
  v_result jsonb;
  v_changes jsonb;
begin
  if v_actor is null then raise exception 'No autenticado para revertir importaciones.' using errcode='42501'; end if;
  if not public.current_user_has_permission('imports.apply') and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para revertir importaciones.' using errcode='42501';
  end if;
  if v_batch_id is null or v_reason is null then raise exception 'El lote y el motivo son obligatorios.' using errcode='22023'; end if;

  select * into v_batch from public.import_batches where id=v_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_batch.status<>'applied' then raise exception 'Solo se puede revertir un lote aplicado.' using errcode='22023'; end if;
  if v_batch.scope_entity_id is not null and not public.current_user_can_manage_entity('imports.apply',v_batch.scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance.' using errcode='42501';
  end if;

  v_plan:=app_private.build_import_reversal_plan(v_batch.id);
  insert into public.import_batch_reversals(batch_id,status,reason,reversal_plan,requested_by)
  values(v_batch.id,case when (v_plan->>'can_reverse')::boolean then 'requested' else 'blocked' end,v_reason,v_plan,v_actor)
  on conflict(batch_id) do update set status=excluded.status,reason=excluded.reason,reversal_plan=excluded.reversal_plan,
    requested_by=excluded.requested_by,requested_at=now(),processed_by=null,processed_at=null,audit_log_id=null,updated_at=now();

  if not (v_plan->>'can_reverse')::boolean then
    v_audit:=public.admin_write_audit_log('import.batch.reversal_blocked','import_batches',v_batch.id,
      jsonb_build_object('reason',v_reason,'plan',v_plan,'canonical_records_modified',false));
    update public.import_batch_reversals set audit_log_id=v_audit,updated_at=now() where batch_id=v_batch.id;
    return jsonb_build_object('batch_id',v_batch.id,'status','blocked','plan',v_plan,'audit_log_id',v_audit);
  end if;

  for v_change in select * from public.import_batch_changes where batch_id=v_batch.id order by recorded_at desc,id desc for update
  loop
    if v_change.operation='noop' then
      continue;
    elsif v_change.operation='update' and v_change.target_table='canonical_events' then
      if not public.current_user_has_permission('events.approve') and not public.current_user_is_super_or_national() then
        raise exception 'La restauración del evento requiere events.approve.' using errcode='42501';
      end if;
      v_changes:=jsonb_strip_nulls(jsonb_build_object(
        'title',v_change.before_data->>'title','description',v_change.before_data->>'description',
        'event_date',v_change.before_data->>'event_date','effective_date',v_change.before_data->>'effective_date',
        'source_name_text',v_change.before_data->>'source_name_text','source_url_text',v_change.before_data->>'source_url_text',
        'source_checked_at',v_change.before_data->>'source_checked_at','verification_status',v_change.before_data->>'verification_status',
        'evidence_status',v_change.before_data->>'evidence_status'
      ));
      perform public.admin_correct_canonical_event(jsonb_build_object(
        'event_id',v_change.target_record_id,'change_reason','Reversión lógica del lote '||v_batch.id||': '||v_reason,
        'source_name','Sistema de importaciones','changes',v_changes
      ));
    elsif v_change.operation='create' and v_change.target_table='canonical_events' then
      update public.canonical_events
      set status='corrected',
          notes_json=coalesce(notes_json,'{}'::jsonb)||jsonb_build_object(
            'import_reversal',jsonb_build_object('batch_id',v_batch.id,'reason',v_reason,'reversed_by',v_actor,'reversed_at',now())
          ),updated_at=now()
      where id=v_change.target_record_id and status in ('draft','pending_review');
      if not found then raise exception 'El evento importado ya no puede retirarse automáticamente.' using errcode='55000'; end if;
    end if;
  end loop;

  v_audit:=public.admin_write_audit_log('import.batch.reversed','import_batches',v_batch.id,
    jsonb_build_object('reason',v_reason,'plan',v_plan,'canonical_records_modified',true));
  update public.import_batch_reversals
  set status='completed',processed_by=v_actor,processed_at=now(),audit_log_id=v_audit,updated_at=now()
  where batch_id=v_batch.id;

  v_result:=jsonb_build_object('batch_id',v_batch.id,'status','completed','plan',v_plan,'audit_log_id',v_audit,'reversed_at',now());
  return v_result;
end;
$$;

create or replace function public.admin_reverse_import_batch(payload jsonb)
returns jsonb
language sql
set search_path='pg_catalog','public','app_private','internal','auth','pg_temp'
as $$ select app_private.admin_reverse_import_batch(payload) $$;

revoke all on function app_private.build_import_reversal_plan(uuid) from public,anon,authenticated;
revoke all on function app_private.admin_reverse_import_batch(jsonb) from public,anon,authenticated;
revoke all on function public.admin_reverse_import_batch(jsonb) from public,anon;
grant execute on function public.admin_reverse_import_batch(jsonb) to authenticated;

commit;
