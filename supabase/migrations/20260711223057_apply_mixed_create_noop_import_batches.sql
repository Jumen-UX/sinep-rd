create or replace function app_private.admin_apply_mixed_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,app_private,internal,auth,pg_temp
as $$
declare
 v_actor uuid:=auth.uid();
 v_batch_id uuid:=nullif(payload->>'batch_id','')::uuid;
 v_shadow_id uuid:=gen_random_uuid();
 v_batch public.import_batches%rowtype;
 v_row public.import_batch_rows%rowtype;
 v_phase jsonb;
 v_phase_audit uuid;
 v_create int;
 v_noop int;
 v_noop_done int:=0;
 v_original_rows int;
 v_original_valid int;
 v_original_warning int;
 v_summary jsonb;
 v_error text;
 v_state text;
begin
 if v_actor is null then raise exception 'No autenticado para aplicar importaciones.' using errcode='42501'; end if;
 if not public.current_user_has_permission('imports.apply') and not public.current_user_is_super_or_national() then raise exception 'No autorizado.' using errcode='42501'; end if;
 select * into v_batch from public.import_batches where id=v_batch_id for update;
 if not found then raise exception 'El lote no existe.' using errcode='P0002'; end if;
 if v_batch.import_type not in ('personas','parroquias','asignaciones','eventos') then raise exception 'Dominio no soportado.' using errcode='0A000'; end if;
 if v_batch.scope_entity_id is not null and not public.current_user_can_manage_entity('imports.apply',v_batch.scope_entity_id) then raise exception 'Fuera de alcance.' using errcode='42501'; end if;
 if v_batch.status='applied' then return jsonb_build_object('batch_id',v_batch.id,'status','applied','idempotent_replay',true,'application_summary',v_batch.application_summary,'applied_at',v_batch.applied_at); end if;
 if v_batch.status not in ('validated','failed') or v_batch.review_status<>'approved' or v_batch.reviewed_by is null then raise exception 'El lote no está aprobado y validado.' using errcode='22023'; end if;
 if v_batch.error_rows+v_batch.duplicate_rows+v_batch.unresolved_rows>0 then raise exception 'El lote mantiene incidencias bloqueantes.' using errcode='22023'; end if;
 if exists(select 1 from public.import_batch_changes where batch_id=v_batch.id) then raise exception 'Estado parcial inconsistente.' using errcode='55000'; end if;
 if exists(select 1 from public.import_batch_rows where batch_id=v_batch.id and (target_operation not in ('create','noop') or status not in ('valid','warning'))) then raise exception 'Operación o estado no permitido.' using errcode='22023'; end if;
 select count(*) filter(where target_operation='create'),count(*) filter(where target_operation='noop') into v_create,v_noop from public.import_batch_rows where batch_id=v_batch.id;
 if v_create=0 or v_noop=0 then raise exception 'El contrato mixto requiere create y noop.' using errcode='22023'; end if;
 v_original_rows:=v_batch.row_count; v_original_valid:=v_batch.valid_rows; v_original_warning:=v_batch.warning_rows;
 begin
  insert into public.import_batches(id,import_type,status,template_version,file_name,file_extension,file_mime_type,file_size_bytes,file_sha256,
   file_last_modified_at,storage_path,source_metadata,scope_entity_id,created_by,validated_by,reviewed_by,row_count,valid_rows,
   warning_rows,error_rows,duplicate_rows,unresolved_rows,validation_summary,validated_at,review_status,review_notes,reviewed_at,
   application_summary,application_attempt_count,created_at,updated_at)
  values(v_shadow_id,v_batch.import_type,'validated',v_batch.template_version,v_batch.file_name||'.noop-shadow',v_batch.file_extension,
   v_batch.file_mime_type,v_batch.file_size_bytes,v_batch.file_sha256,v_batch.file_last_modified_at,v_batch.storage_path,
   v_batch.source_metadata||jsonb_build_object('internal_shadow_for_batch',v_batch.id),v_batch.scope_entity_id,v_batch.created_by,
   v_batch.validated_by,v_batch.reviewed_by,v_noop,v_noop,0,0,0,0,jsonb_build_object('internal_shadow',true),v_batch.validated_at,
   'approved','Lote sombra interno.',v_batch.reviewed_at,'{}'::jsonb,0,now(),now());
  update public.import_batch_row_issues i set batch_id=v_shadow_id where i.batch_id=v_batch.id and exists(
   select 1 from public.import_batch_rows r where r.id=i.row_id and r.batch_id=v_batch.id and r.target_operation='noop');
  update public.import_batch_rows set batch_id=v_shadow_id where batch_id=v_batch.id and target_operation='noop';
  update public.import_batches set row_count=v_create,
   valid_rows=(select count(*) from public.import_batch_rows where batch_id=v_batch.id and status='valid'),
   warning_rows=(select count(*) from public.import_batch_rows where batch_id=v_batch.id and status='warning'),updated_at=now()
  where id=v_batch.id;
  if v_batch.import_type='personas' then v_phase:=app_private.admin_apply_person_import_batch(payload);
  elsif v_batch.import_type='parroquias' then v_phase:=app_private.admin_apply_structure_import_batch(payload);
  elsif v_batch.import_type='asignaciones' then v_phase:=app_private.admin_apply_assignment_import_batch(payload);
  else v_phase:=app_private.admin_apply_event_import_batch(payload); end if;
  if coalesce(v_phase->>'status','')<>'applied' then raise exception 'Falló la fase create: %',coalesce(v_phase->>'error','sin detalle'); end if;
  v_phase_audit:=nullif(v_phase->>'audit_log_id','')::uuid;
  if v_phase_audit is not null then update public.audit_logs set action='import.batch.create_phase_applied',
   new_data=coalesce(new_data,'{}'::jsonb)||jsonb_build_object('mixed_batch',true,'noop_rows_pending',v_noop) where id=v_phase_audit; end if;
  update public.import_batches set status='applying',row_count=v_original_rows,valid_rows=v_original_valid,warning_rows=v_original_warning,
   applied_rows=v_create,applied_at=null,applied_by=null,application_summary=jsonb_build_object('status','applying','domain',v_batch.import_type,
   'contract_version',3,'created_rows',v_create,'noop_rows_pending',v_noop),updated_at=now() where id=v_batch.id;
  for v_row in select * from public.import_batch_rows where batch_id=v_shadow_id order by row_number for update loop
   update public.import_batch_rows set batch_id=v_batch.id where id=v_row.id;
   update public.import_batch_row_issues set batch_id=v_batch.id where row_id=v_row.id;
   perform app_private.record_import_noop_row(v_batch.id,v_row.id,true);
   v_noop_done:=v_noop_done+1;
  end loop;
  delete from public.import_batches where id=v_shadow_id;
  v_summary:=jsonb_build_object('batch_id',v_batch.id,'status','applied','review_status',v_batch.review_status,'row_count',v_original_rows,
   'applied_rows',v_create+v_noop_done,'created_rows',v_create,'noop_rows',v_noop_done,'updated_rows',0,'domain',v_batch.import_type,
   'contract_version',3,'can_apply',false,'application_rpc_available',true,'idempotent_replay',false,
   'canonical_records_modified',true,'applied_at',now());
  update public.import_batches set status='applied',row_count=v_original_rows,valid_rows=v_original_valid,warning_rows=v_original_warning,
   applied_by=v_actor,applied_rows=v_create+v_noop_done,application_summary=v_summary,last_error=null,applied_at=now(),updated_at=now()
  where id=v_batch.id;
  perform public.admin_write_audit_log('import.batch.applied','import_batches',v_batch.id,jsonb_build_object('import_type',v_batch.import_type,
   'row_count',v_original_rows,'created_rows',v_create,'noop_rows',v_noop_done,'scope_entity_id',v_batch.scope_entity_id,
   'file_sha256',v_batch.file_sha256,'contract_version',3,'canonical_records_modified',true));
  return v_summary;
 exception when others then get stacked diagnostics v_error=message_text,v_state=returned_sqlstate; end;
 v_summary:=jsonb_build_object('batch_id',v_batch.id,'status','failed','row_count',v_original_rows,'applied_rows',0,
  'created_rows',0,'noop_rows',0,'updated_rows',0,'domain',v_batch.import_type,'contract_version',3,'can_apply',true,
  'application_rpc_available',true,'idempotent_replay',false,'canonical_records_modified',false,'error',v_error,'sqlstate',v_state);
 update public.import_batches set status='failed',row_count=v_original_rows,valid_rows=v_original_valid,warning_rows=v_original_warning,
  applied_rows=0,application_summary=v_summary,last_error=v_error,applied_at=null,applied_by=null,updated_at=now() where id=v_batch.id;
 perform public.admin_write_audit_log('import.batch.application_failed','import_batches',v_batch.id,
  jsonb_build_object('import_type',v_batch.import_type,'contract_version',3,'error',v_error,'sqlstate',v_state,'canonical_records_modified',false));
 return v_summary;
end;$$;
revoke all on function app_private.admin_apply_mixed_import_batch(jsonb) from public,anon,authenticated;
