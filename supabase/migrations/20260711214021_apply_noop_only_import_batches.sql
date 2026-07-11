create or replace function app_private.admin_apply_noop_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'app_private', 'internal', 'auth', 'pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_batch_id uuid:=nullif(payload->>'batch_id','')::uuid;
  v_batch public.import_batches%rowtype;
  v_row public.import_batch_rows%rowtype;
  v_before jsonb;
  v_audit uuid;
  v_batch_audit uuid;
  v_count integer:=0;
  v_summary jsonb;
begin
  if v_actor is null then raise exception 'No autenticado para aplicar importaciones.' using errcode='42501'; end if;
  if not public.current_user_has_permission('imports.apply') and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para aplicar importaciones.' using errcode='42501';
  end if;
  select * into v_batch from public.import_batches where id=v_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_batch.scope_entity_id is not null and not public.current_user_can_manage_entity('imports.apply',v_batch.scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance de aplicación.' using errcode='42501';
  end if;
  if v_batch.status='applied' then
    return jsonb_build_object('batch_id',v_batch.id,'status','applied','review_status',v_batch.review_status,
      'row_count',v_batch.row_count,'applied_rows',v_batch.applied_rows,'can_apply',false,
      'application_rpc_available',true,'idempotent_replay',true,'application_summary',v_batch.application_summary,
      'applied_at',v_batch.applied_at);
  end if;
  if v_batch.status not in ('validated','failed') then raise exception 'El lote debe estar validado antes de aplicarse.' using errcode='22023'; end if;
  if v_batch.review_status<>'approved' or v_batch.reviewed_by is null then raise exception 'El lote requiere aprobación editorial vigente.' using errcode='22023'; end if;
  if exists(select 1 from public.import_batch_rows where batch_id=v_batch.id and (target_operation<>'noop' or target_record_id is null or status not in ('valid','warning'))) then
    raise exception 'Este contrato solo puede aplicar lotes compuestos completamente por operaciones noop.' using errcode='0A000';
  end if;
  if exists(select 1 from public.import_batch_changes where batch_id=v_batch.id) then
    raise exception 'El lote presenta un estado parcial o inconsistente.' using errcode='55000';
  end if;

  update public.import_batches set status='applying',application_started_at=now(),
    application_attempt_count=application_attempt_count+1,
    application_summary=jsonb_build_object('status','applying','domain',v_batch.import_type,'contract_version',2,'operation','noop'),
    last_error=null,updated_at=now() where id=v_batch.id;

  for v_row in select * from public.import_batch_rows where batch_id=v_batch.id order by row_number for update loop
    if v_row.target_table='ecclesiastical_entities' then
      select jsonb_build_object('id',ee.id,'name',ee.name,'official_name',ee.official_name,'status',ee.status,'visibility',ee.visibility)
      into v_before from public.ecclesiastical_entities ee where ee.id=v_row.target_record_id;
    elsif v_row.target_table='position_assignments' then
      select jsonb_build_object('id',pa.id,'person_id',pa.person_id,'office_configuration_id',pa.office_configuration_id,
        'ecclesiastical_entity_id',pa.ecclesiastical_entity_id,'start_date',pa.start_date,'actual_end_date',pa.actual_end_date,
        'is_current',pa.is_current,'assignment_status',pa.assignment_status)
      into v_before from public.position_assignments pa where pa.id=v_row.target_record_id;
    elsif v_row.target_table='canonical_events' then
      select jsonb_build_object('id',ce.id,'title',ce.title,'status',ce.status,'event_date',ce.event_date,
        'effective_date',ce.effective_date,'event_type_id',ce.event_type_id)
      into v_before from public.canonical_events ce where ce.id=v_row.target_record_id;
    else
      raise exception 'La fila % usa una tabla no permitida para noop.',v_row.row_number using errcode='22023';
    end if;
    if v_before is null then raise exception 'El registro enlazado de la fila % ya no existe.',v_row.row_number using errcode='P0002'; end if;
    v_audit:=public.admin_write_audit_log('import.row.noop',v_row.target_table,v_row.target_record_id,
      jsonb_build_object('batch_id',v_batch.id,'row_id',v_row.id,'row_number',v_row.row_number,
        'reason',v_row.resolved_relations->>'noop_reason','canonical_records_modified',false));
    insert into public.import_batch_changes(batch_id,row_id,operation,target_schema,target_table,target_record_id,before_data,after_data,audit_log_id)
    values(v_batch.id,v_row.id,'noop',coalesce(v_row.target_schema,'public'),v_row.target_table,v_row.target_record_id,v_before,v_before,v_audit);
    update public.import_batch_rows set status='skipped',applied_at=now(),updated_at=now() where id=v_row.id;
    v_count:=v_count+1;
  end loop;

  v_summary:=jsonb_build_object('batch_id',v_batch.id,'status','applied','review_status',v_batch.review_status,
    'row_count',v_batch.row_count,'applied_rows',v_count,'noop_rows',v_count,'created_rows',0,'updated_rows',0,
    'domain',v_batch.import_type,'contract_version',2,'can_apply',false,'application_rpc_available',true,
    'idempotent_replay',false,'canonical_records_modified',false,'applied_at',now());
  update public.import_batches set status='applied',applied_by=v_actor,applied_rows=v_count,
    application_summary=v_summary,last_error=null,applied_at=now(),updated_at=now() where id=v_batch.id;
  v_batch_audit:=public.admin_write_audit_log('import.batch.applied','import_batches',v_batch.id,
    jsonb_build_object('import_type',v_batch.import_type,'row_count',v_batch.row_count,'noop_rows',v_count,
      'scope_entity_id',v_batch.scope_entity_id,'file_sha256',v_batch.file_sha256,'contract_version',2,
      'canonical_records_modified',false));
  return v_summary||jsonb_build_object('audit_log_id',v_batch_audit);
end;
$function$;

create or replace function app_private.admin_apply_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'app_private', 'internal', 'auth', 'pg_temp'
as $function$
declare
  v_type text;
  v_batch uuid:=nullif(payload->>'batch_id','')::uuid;
  v_total integer;
  v_noop integer;
begin
  select import_type into v_type from public.import_batches where id=v_batch;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  select count(*),count(*) filter(where target_operation='noop') into v_total,v_noop
  from public.import_batch_rows where batch_id=v_batch;
  if v_total>0 and v_noop=v_total then return app_private.admin_apply_noop_import_batch(payload); end if;
  if v_noop>0 then raise exception 'Los lotes mixtos con create y noop todavía requieren el contrato de aplicación mixto.' using errcode='0A000'; end if;
  if v_type='personas' then return app_private.admin_apply_person_import_batch(payload); end if;
  if v_type='parroquias' then return app_private.admin_apply_structure_import_batch(payload); end if;
  if v_type='asignaciones' then return app_private.admin_apply_assignment_import_batch(payload); end if;
  if v_type='eventos' then return app_private.admin_apply_event_import_batch(payload); end if;
  raise exception 'Este tipo de importación todavía no tiene contrato de aplicación.' using errcode='0A000';
end;
$function$;

revoke all on function app_private.admin_apply_noop_import_batch(jsonb) from public, anon, authenticated;
grant execute on function app_private.admin_apply_noop_import_batch(jsonb) to service_role;