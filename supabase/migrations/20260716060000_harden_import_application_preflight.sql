begin;

create or replace function app_private.import_application_preflight(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,app_private,auth,pg_temp
as $$
declare
  v_batch public.import_batches%rowtype;
  v_total integer;
  v_create integer;
  v_update integer;
  v_noop integer;
begin
  select * into v_batch from public.import_batches where id=p_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;

  select count(*),
         count(*) filter(where target_operation='create'),
         count(*) filter(where target_operation='update'),
         count(*) filter(where target_operation='noop')
  into v_total,v_create,v_update,v_noop
  from public.import_batch_rows where batch_id=p_batch_id;

  if v_total=0 or v_total<>v_batch.row_count then
    raise exception 'La cantidad de filas persistidas no coincide con el resumen del lote.' using errcode='22023';
  end if;
  if exists(select 1 from public.import_batch_row_issues where batch_id=p_batch_id and status='open' and issue_type in ('validation_error','duplicate','unresolved_relation')) then
    raise exception 'El lote mantiene incidencias bloqueantes.' using errcode='22023';
  end if;
  if exists(
    select 1 from public.import_batch_rows r
    where r.batch_id=p_batch_id and (
      r.status not in ('valid','warning')
      or r.target_operation not in ('create','update','noop')
      or coalesce(r.target_schema,'public')<>'public'
      or r.target_table is null
      or (r.target_operation='create' and r.target_record_id is not null)
      or (r.target_operation in ('update','noop') and r.target_record_id is null)
    )
  ) then
    raise exception 'La proyección de aplicación contiene filas bloqueadas o no resueltas.' using errcode='22023';
  end if;

  return jsonb_build_object('batch_id',p_batch_id,'total_rows',v_total,'create_rows',v_create,'update_rows',v_update,'noop_rows',v_noop);
end;
$$;

create or replace function app_private.admin_apply_person_noop_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,app_private,internal,auth,pg_temp
as $$
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
  if not public.current_user_has_permission('imports.apply') and not public.current_user_is_super_or_national() then raise exception 'No autorizado para aplicar importaciones.' using errcode='42501'; end if;
  select * into v_batch from public.import_batches where id=v_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_batch.import_type<>'personas' then raise exception 'El lote no corresponde a personas.' using errcode='22023'; end if;
  if v_batch.scope_entity_id is not null and not public.current_user_can_manage_entity('imports.apply',v_batch.scope_entity_id) then raise exception 'El lote está fuera de tu alcance de aplicación.' using errcode='42501'; end if;
  if v_batch.status='applied' then return jsonb_build_object('batch_id',v_batch.id,'status','applied','idempotent_replay',true,'application_summary',v_batch.application_summary,'applied_at',v_batch.applied_at); end if;
  if v_batch.status not in ('validated','failed') or v_batch.review_status<>'approved' or v_batch.reviewed_by is null then raise exception 'El lote debe estar validado y aprobado.' using errcode='22023'; end if;
  perform app_private.import_application_preflight(v_batch.id);
  if exists(select 1 from public.import_batch_rows where batch_id=v_batch.id and (target_operation<>'noop' or target_table<>'persons')) then raise exception 'Este contrato solo admite coincidencias noop de personas.' using errcode='0A000'; end if;
  if exists(select 1 from public.import_batch_changes where batch_id=v_batch.id) then raise exception 'El lote presenta un estado parcial o inconsistente.' using errcode='55000'; end if;

  update public.import_batches set status='applying',application_started_at=now(),application_attempt_count=application_attempt_count+1,application_summary=jsonb_build_object('status','applying','domain','personas','contract_version',5,'operation','noop'),last_error=null,updated_at=now() where id=v_batch.id;

  for v_row in select * from public.import_batch_rows where batch_id=v_batch.id order by row_number for update loop
    select jsonb_build_object('id',p.id,'display_name',p.display_name,'status',p.status,'visibility',p.visibility)
    into v_before from public.persons p where p.id=v_row.target_record_id;
    if v_before is null then raise exception 'La persona enlazada de la fila % ya no existe.',v_row.row_number using errcode='P0002'; end if;
    v_audit:=public.admin_write_audit_log('import.row.noop','persons',v_row.target_record_id,jsonb_build_object('batch_id',v_batch.id,'row_id',v_row.id,'row_number',v_row.row_number,'reason',v_row.resolved_relations->>'noop_reason','canonical_records_modified',false));
    insert into public.import_batch_changes(batch_id,row_id,operation,target_schema,target_table,target_record_id,before_data,after_data,audit_log_id)
    values(v_batch.id,v_row.id,'noop','public','persons',v_row.target_record_id,v_before,v_before,v_audit);
    update public.import_batch_rows set status='skipped',applied_at=now(),updated_at=now() where id=v_row.id;
    v_count:=v_count+1;
  end loop;

  v_summary:=jsonb_build_object('batch_id',v_batch.id,'status','applied','review_status',v_batch.review_status,'row_count',v_batch.row_count,'applied_rows',v_count,'noop_rows',v_count,'created_rows',0,'updated_rows',0,'domain','personas','contract_version',5,'can_apply',false,'application_rpc_available',true,'idempotent_replay',false,'canonical_records_modified',false,'applied_at',now());
  update public.import_batches set status='applied',applied_by=v_actor,applied_rows=v_count,application_summary=v_summary,last_error=null,applied_at=now(),updated_at=now() where id=v_batch.id;
  v_batch_audit:=public.admin_write_audit_log('import.batch.applied','import_batches',v_batch.id,jsonb_build_object('import_type','personas','row_count',v_batch.row_count,'noop_rows',v_count,'scope_entity_id',v_batch.scope_entity_id,'file_sha256',v_batch.file_sha256,'contract_version',5,'canonical_records_modified',false));
  return v_summary||jsonb_build_object('audit_log_id',v_batch_audit);
end;
$$;

create or replace function app_private.admin_apply_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','app_private','internal','auth','pg_temp'
as $$
declare
  v_actor uuid:=auth.uid();
  v_type text;
  v_batch uuid:=nullif(payload->>'batch_id','')::uuid;
  v_projection jsonb;
  v_total integer;
  v_create integer;
  v_noop integer;
  v_update integer;
begin
  if v_actor is null then raise exception 'No autenticado para aplicar importaciones.' using errcode='42501'; end if;
  if not public.current_user_has_permission('imports.apply') and not public.current_user_is_super_or_national() then raise exception 'No autorizado para aplicar importaciones.' using errcode='42501'; end if;
  select import_type into v_type from public.import_batches where id=v_batch;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;

  v_projection:=app_private.import_application_preflight(v_batch);
  v_total:=(v_projection->>'total_rows')::integer;
  v_create:=(v_projection->>'create_rows')::integer;
  v_update:=(v_projection->>'update_rows')::integer;
  v_noop:=(v_projection->>'noop_rows')::integer;

  if v_noop=v_total then
    if v_type='personas' then return app_private.admin_apply_person_noop_import_batch(payload); end if;
    return app_private.admin_apply_noop_import_batch(payload);
  end if;
  if v_update=v_total and v_type='eventos' then return app_private.admin_apply_event_update_import_batch(payload); end if;
  if v_create>0 and v_noop>0 and v_create+v_noop=v_total then return app_private.admin_apply_mixed_import_batch(payload); end if;
  if v_noop>0 or v_update>0 then raise exception 'El lote contiene una combinación de operaciones todavía no soportada.' using errcode='0A000'; end if;
  if v_type='personas' then return app_private.admin_apply_person_import_batch(payload); end if;
  if v_type='parroquias' then return app_private.admin_apply_structure_import_batch(payload); end if;
  if v_type='asignaciones' then return app_private.admin_apply_assignment_import_batch(payload); end if;
  if v_type='eventos' then return app_private.admin_apply_event_import_batch(payload); end if;
  raise exception 'Este tipo de importación todavía no tiene contrato de aplicación.' using errcode='0A000';
end;
$$;

revoke all on function app_private.import_application_preflight(uuid) from public,anon,authenticated;
revoke all on function app_private.admin_apply_person_noop_import_batch(jsonb) from public,anon,authenticated;
revoke all on function app_private.admin_apply_import_batch(jsonb) from public,anon,authenticated;
grant execute on function app_private.admin_apply_import_batch(jsonb) to service_role;

commit;
