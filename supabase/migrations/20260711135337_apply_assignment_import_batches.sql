-- Apply approved assignment batches through the canonical appointment writer.

create or replace function app_private.admin_apply_assignment_import_batch(payload jsonb)
returns jsonb language plpgsql security definer
set search_path=public,app_private,internal,auth,pg_temp as $$
declare
  v_actor uuid:=auth.uid(); v_batch_id uuid:=nullif(payload->>'batch_id','')::uuid;
  v_batch public.import_batches%rowtype; v_row public.import_batch_rows%rowtype;
  v_result jsonb; v_assignment_id uuid; v_after jsonb; v_row_audit uuid; v_batch_audit uuid;
  v_applied int:=0; v_summary jsonb; v_error text; v_state text;
  v_person_id uuid; v_office_id uuid; v_entity_id uuid; v_is_current boolean;
begin
  if v_actor is null then raise exception 'No autenticado para aplicar importaciones.' using errcode='42501'; end if;
  if not public.current_user_has_permission('imports.apply') and not public.current_user_is_super_or_national() then raise exception 'No autorizado para aplicar importaciones.' using errcode='42501'; end if;
  select * into v_batch from public.import_batches where id=v_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_batch.import_type<>'asignaciones' then raise exception 'El lote no corresponde a nombramientos.' using errcode='22023'; end if;
  if v_batch.scope_entity_id is not null and not public.current_user_can_manage_entity('imports.apply',v_batch.scope_entity_id) then raise exception 'El lote está fuera de tu alcance de aplicación.' using errcode='42501'; end if;
  if v_batch.status='applied' then return jsonb_build_object('batch_id',v_batch.id,'status','applied','review_status',v_batch.review_status,'row_count',v_batch.row_count,'applied_rows',v_batch.applied_rows,'can_apply',false,'application_rpc_available',true,'idempotent_replay',true,'application_summary',v_batch.application_summary,'applied_at',v_batch.applied_at); end if;
  if v_batch.status='applying' then raise exception 'El lote ya está siendo aplicado.' using errcode='55000'; end if;
  if v_batch.status not in ('validated','failed') then raise exception 'El lote debe estar validado antes de aplicarse.' using errcode='22023'; end if;
  if v_batch.review_status<>'approved' or v_batch.reviewed_by is null then raise exception 'El lote requiere aprobación editorial vigente.' using errcode='22023'; end if;
  if v_batch.error_rows+v_batch.duplicate_rows+v_batch.unresolved_rows>0 then raise exception 'El lote mantiene incidencias bloqueantes.' using errcode='22023'; end if;
  if exists(select 1 from public.import_batch_changes where batch_id=v_batch.id) then raise exception 'El lote presenta un estado parcial o inconsistente.' using errcode='55000'; end if;
  update public.import_batches set status='applying',application_started_at=now(),application_attempt_count=application_attempt_count+1,application_summary=jsonb_build_object('status','applying','domain','asignaciones','contract_version',1,'started_at',now()),last_error=null,updated_at=now() where id=v_batch.id;
  begin
    for v_row in select * from public.import_batch_rows where batch_id=v_batch.id order by row_number for update loop
      if v_row.status not in ('valid','warning') or v_row.target_operation<>'create' or v_row.target_table<>'position_assignments' or v_row.target_record_id is not null then raise exception 'La fila % no está lista para aplicación.',v_row.row_number; end if;
      v_person_id:=nullif(v_row.resolved_relations->>'persona','')::uuid; v_office_id:=nullif(v_row.resolved_relations->>'cargo','')::uuid; v_entity_id:=nullif(v_row.resolved_relations->>'entidad','')::uuid; v_is_current:=coalesce((v_row.resolved_relations->>'is_current')::boolean,true);
      v_result:=public.admin_save_position_assignment(jsonb_strip_nulls(jsonb_build_object('person_id',v_person_id,'office_configuration_id',v_office_id,'ecclesiastical_entity_id',v_entity_id,'start_date',nullif(v_row.normalized_data->>'fecha_inicio',''),'actual_end_date',case when v_is_current then null else nullif(v_row.normalized_data->>'fecha_fin','') end,'term_end_date',nullif(v_row.normalized_data->>'fecha_fin',''),'assignment_status',case when v_is_current then 'active' else 'ended' end,'selection_method','appointment','verification_status','pending_review','visibility',coalesce(nullif(lower(btrim(v_row.normalized_data->>'visibilidad')),''),'public'),'source_name',coalesce(nullif(btrim(v_row.normalized_data->>'fuente'),''),v_batch.file_name),'notes_internal',format('Creado por el lote de importación %s, fila %s.',v_batch.id,v_row.row_number),'close_previous_current',v_is_current)));
      v_assignment_id:=nullif(v_result->>'assignment_id','')::uuid;
      if v_assignment_id is null then raise exception 'El motor canónico no devolvió el nombramiento creado para la fila %.',v_row.row_number; end if;
      select jsonb_build_object('assignment_id',pa.id,'person_id',pa.person_id,'office_configuration_id',pa.office_configuration_id,'ecclesiastical_entity_id',pa.ecclesiastical_entity_id,'start_date',pa.start_date,'actual_end_date',pa.actual_end_date,'is_current',pa.is_current,'assignment_status',pa.assignment_status,'closed_previous_current_count',coalesce((v_result->>'closed_previous_current_count')::int,0)) into v_after from public.position_assignments pa where pa.id=v_assignment_id;
      v_row_audit:=public.admin_write_audit_log('import.assignment.created','position_assignments',v_assignment_id,jsonb_build_object('batch_id',v_batch.id,'row_id',v_row.id,'row_number',v_row.row_number,'entity_id',v_entity_id,'canonical_records_modified',true));
      insert into public.import_batch_changes(batch_id,row_id,operation,target_schema,target_table,target_record_id,before_data,after_data,audit_log_id) values(v_batch.id,v_row.id,'create','public','position_assignments',v_assignment_id,null,v_after,v_row_audit);
      update public.import_batch_rows set status='applied',target_record_id=v_assignment_id,applied_at=now(),updated_at=now() where id=v_row.id; v_applied:=v_applied+1;
    end loop;
    v_summary:=jsonb_build_object('batch_id',v_batch.id,'status','applied','review_status',v_batch.review_status,'row_count',v_batch.row_count,'applied_rows',v_applied,'domain','asignaciones','contract_version',1,'can_apply',false,'application_rpc_available',true,'idempotent_replay',false,'applied_at',now());
    update public.import_batches set status='applied',applied_by=v_actor,applied_rows=v_applied,application_summary=v_summary,last_error=null,applied_at=now(),updated_at=now() where id=v_batch.id;
    v_batch_audit:=public.admin_write_audit_log('import.batch.applied','import_batches',v_batch.id,jsonb_build_object('import_type','asignaciones','row_count',v_batch.row_count,'applied_rows',v_applied,'scope_entity_id',v_batch.scope_entity_id,'file_sha256',v_batch.file_sha256,'contract_version',1,'canonical_records_modified',true));
    return v_summary||jsonb_build_object('audit_log_id',v_batch_audit);
  exception when others then get stacked diagnostics v_error=message_text,v_state=returned_sqlstate; end;
  v_summary:=jsonb_build_object('batch_id',v_batch.id,'status','failed','review_status',v_batch.review_status,'row_count',v_batch.row_count,'applied_rows',0,'domain','asignaciones','contract_version',1,'can_apply',true,'application_rpc_available',true,'idempotent_replay',false,'error',v_error,'sqlstate',v_state);
  update public.import_batches set status='failed',applied_rows=0,application_summary=v_summary,last_error=v_error,updated_at=now() where id=v_batch.id;
  perform public.admin_write_audit_log('import.batch.apply_failed','import_batches',v_batch.id,jsonb_build_object('import_type','asignaciones','error',v_error,'sqlstate',v_state,'canonical_records_modified',false));
  return v_summary;
end; $$;

revoke all on function app_private.admin_apply_assignment_import_batch(jsonb) from public,anon,authenticated;

create or replace function app_private.admin_apply_import_batch(payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,app_private,internal,auth,pg_temp as $$
declare v_type text; v_batch uuid:=nullif(payload->>'batch_id','')::uuid;
begin
  select import_type into v_type from public.import_batches where id=v_batch;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_type='personas' then return app_private.admin_apply_person_import_batch(payload); end if;
  if v_type='parroquias' then return app_private.admin_apply_structure_import_batch(payload); end if;
  if v_type='asignaciones' then return app_private.admin_apply_assignment_import_batch(payload); end if;
  raise exception 'Este tipo de importación todavía no tiene contrato de aplicación.' using errcode='0A000';
end; $$;