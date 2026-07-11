create or replace function app_private.record_import_noop_row(p_batch_id uuid,p_row_id uuid,p_mixed boolean default false)
returns uuid
language plpgsql
security definer
set search_path=public,app_private,internal,auth,pg_temp
as $$
declare
 v_row public.import_batch_rows%rowtype;
 v_before jsonb;
 v_audit uuid;
begin
 select * into v_row from public.import_batch_rows where id=p_row_id for update;
 if not found or v_row.target_operation<>'noop' or v_row.target_record_id is null then
  raise exception 'La fila no está lista para noop.' using errcode='22023';
 end if;
 if v_row.target_table='ecclesiastical_entities' then
  select jsonb_build_object('id',id,'name',name,'official_name',official_name,'status',status,'visibility',visibility)
  into v_before from public.ecclesiastical_entities where id=v_row.target_record_id;
 elsif v_row.target_table='position_assignments' then
  select jsonb_build_object('id',id,'person_id',person_id,'office_configuration_id',office_configuration_id,
   'ecclesiastical_entity_id',ecclesiastical_entity_id,'start_date',start_date,'actual_end_date',actual_end_date,
   'is_current',is_current,'assignment_status',assignment_status)
  into v_before from public.position_assignments where id=v_row.target_record_id;
 elsif v_row.target_table='canonical_events' then
  select jsonb_build_object('id',id,'title',title,'status',status,'event_date',event_date,
   'effective_date',effective_date,'event_type_id',event_type_id)
  into v_before from public.canonical_events where id=v_row.target_record_id;
 else
  raise exception 'Tabla no permitida para noop.' using errcode='22023';
 end if;
 if v_before is null then raise exception 'El registro enlazado ya no existe.' using errcode='P0002'; end if;
 v_audit:=public.admin_write_audit_log('import.row.noop',v_row.target_table,v_row.target_record_id,
  jsonb_build_object('batch_id',p_batch_id,'row_id',v_row.id,'row_number',v_row.row_number,
   'reason',v_row.resolved_relations->>'noop_reason','mixed_batch',p_mixed,'canonical_records_modified',false));
 insert into public.import_batch_changes(batch_id,row_id,operation,target_schema,target_table,target_record_id,before_data,after_data,audit_log_id)
 values(p_batch_id,v_row.id,'noop',coalesce(v_row.target_schema,'public'),v_row.target_table,v_row.target_record_id,v_before,v_before,v_audit);
 update public.import_batch_rows set status='skipped',applied_at=now(),updated_at=now() where id=v_row.id;
 return v_audit;
end;$$;
revoke all on function app_private.record_import_noop_row(uuid,uuid,boolean) from public,anon,authenticated;
