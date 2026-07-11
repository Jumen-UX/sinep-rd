alter function app_private.admin_apply_import_batch(jsonb) rename to admin_apply_person_import_batch;

create or replace function app_private.admin_apply_structure_import_batch(payload jsonb)
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
  v_result jsonb;
  v_entity uuid;
  v_node uuid;
  v_after jsonb;
  v_audit uuid;
  v_batch_audit uuid;
  v_count integer:=0;
  v_summary jsonb;
  v_error text;
  v_state text;
begin
  if v_actor is null then raise exception 'No autenticado para aplicar importaciones.' using errcode='42501'; end if;
  if not public.current_user_has_permission('imports.apply') and not public.current_user_is_super_or_national() then raise exception 'No autorizado para aplicar importaciones.' using errcode='42501'; end if;
  select * into v_batch from public.import_batches where id=v_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_batch.import_type<>'parroquias' then raise exception 'El lote no corresponde a estructuras.' using errcode='22023'; end if;
  if v_batch.scope_entity_id is not null and not public.current_user_can_manage_entity('imports.apply',v_batch.scope_entity_id) then raise exception 'El lote está fuera de tu alcance de aplicación.' using errcode='42501'; end if;
  if v_batch.status='applied' then return jsonb_build_object('batch_id',v_batch.id,'status','applied','review_status',v_batch.review_status,'row_count',v_batch.row_count,'applied_rows',v_batch.applied_rows,'can_apply',false,'application_rpc_available',true,'idempotent_replay',true,'application_summary',v_batch.application_summary,'applied_at',v_batch.applied_at); end if;
  if v_batch.status='applying' then raise exception 'El lote ya está siendo aplicado.' using errcode='55000'; end if;
  if v_batch.status not in ('validated','failed') then raise exception 'El lote debe estar validado antes de aplicarse.' using errcode='22023'; end if;
  if v_batch.review_status<>'approved' or v_batch.reviewed_by is null then raise exception 'El lote requiere aprobación editorial vigente antes de aplicarse.' using errcode='22023'; end if;
  if v_batch.error_rows+v_batch.duplicate_rows+v_batch.unresolved_rows>0 then raise exception 'El lote mantiene incidencias bloqueantes.' using errcode='22023'; end if;
  if exists(select 1 from public.import_batch_rows r where r.batch_id=v_batch.id and (r.status not in ('valid','warning') or r.target_operation<>'create' or r.target_table<>'ecclesiastical_entities' or r.target_record_id is not null or r.applied_at is not null)) or exists(select 1 from public.import_batch_changes c where c.batch_id=v_batch.id) then raise exception 'El lote presenta un estado parcial o inconsistente.' using errcode='55000'; end if;

  update public.import_batches set status='applying',application_started_at=now(),application_attempt_count=application_attempt_count+1,application_summary=jsonb_build_object('status','applying','domain','parroquias','contract_version',1,'started_at',now()),last_error=null,updated_at=now() where id=v_batch.id;

  begin
    for v_row in select * from public.import_batch_rows where batch_id=v_batch.id order by row_number for update loop
      v_result:=public.admin_create_structure_node_entity(jsonb_strip_nulls(jsonb_build_object(
        'template_id',v_row.resolved_relations->>'template_id','level_id',v_row.resolved_relations->>'level_id','parent_node_id',v_row.resolved_relations->>'parent_node_id','parent_entity_id',v_row.resolved_relations->>'parent_entity_id',
        'entity_type_key',lower(v_row.normalized_data->>'tipo_entidad'),'name',v_row.normalized_data->>'nombre','official_name',nullif(btrim(v_row.normalized_data->>'nombre_oficial'),''),'description',nullif(btrim(v_row.normalized_data->>'descripcion'),''),
        'country_iso2',upper(v_row.normalized_data->>'pais_iso2'),'start_date',coalesce(nullif(v_row.normalized_data->>'fecha_inicio',''),current_date::text),'visibility',coalesce(nullif(lower(v_row.normalized_data->>'visibilidad'),''),'public'),
        'source_name',coalesce(nullif(btrim(v_row.normalized_data->>'fuente'),''),v_batch.file_name),'source_url',nullif(btrim(v_row.normalized_data->>'url_fuente'),''),'source_checked_at',nullif(v_row.normalized_data->>'fecha_revision_fuente',''),'not_identified_fields',jsonb_build_array('phone','email','website')
      )));
      v_entity:=nullif(v_result->>'entity_id','')::uuid;
      v_node:=nullif(v_result->>'node_id','')::uuid;
      if v_entity is null or v_node is null then raise exception 'El motor estructural no devolvió entidad y nodo para la fila %.',v_row.row_number; end if;
      update public.ecclesiastical_entities set address=coalesce(nullif(btrim(v_row.normalized_data->>'direccion'),''),address),updated_at=now() where id=v_entity;
      select jsonb_build_object('entity_id',ee.id,'node_id',v_node,'name',ee.name,'slug',ee.slug,'entity_type_key',et.key,'parent_entity_id',v_row.resolved_relations->>'parent_entity_id','parent_node_id',v_row.resolved_relations->>'parent_node_id','template_id',v_row.resolved_relations->>'template_id','level_id',v_row.resolved_relations->>'level_id') into v_after from public.ecclesiastical_entities ee join public.entity_types et on et.id=ee.entity_type_id where ee.id=v_entity;
      v_audit:=public.admin_write_audit_log('import.structure.created','ecclesiastical_entities',v_entity,jsonb_build_object('batch_id',v_batch.id,'row_id',v_row.id,'row_number',v_row.row_number,'node_id',v_node,'scope_entity_id',v_batch.scope_entity_id,'file_sha256',v_batch.file_sha256,'canonical_records_modified',true));
      insert into public.import_batch_changes(batch_id,row_id,operation,target_schema,target_table,target_record_id,before_data,after_data,audit_log_id) values(v_batch.id,v_row.id,'create','public','ecclesiastical_entities',v_entity,null,v_after,v_audit);
      update public.import_batch_rows set status='applied',target_record_id=v_entity,applied_at=now(),updated_at=now() where id=v_row.id;
      v_count:=v_count+1;
    end loop;
    v_summary:=jsonb_build_object('batch_id',v_batch.id,'status','applied','review_status',v_batch.review_status,'row_count',v_batch.row_count,'applied_rows',v_count,'domain','parroquias','contract_version',1,'can_apply',false,'application_rpc_available',true,'idempotent_replay',false,'applied_at',now());
    update public.import_batches set status='applied',applied_by=v_actor,applied_rows=v_count,application_summary=v_summary,last_error=null,applied_at=now(),updated_at=now() where id=v_batch.id;
    v_batch_audit:=public.admin_write_audit_log('import.batch.applied','import_batches',v_batch.id,jsonb_build_object('import_type','parroquias','row_count',v_batch.row_count,'applied_rows',v_count,'scope_entity_id',v_batch.scope_entity_id,'file_sha256',v_batch.file_sha256,'contract_version',1,'canonical_records_modified',true));
    return v_summary||jsonb_build_object('audit_log_id',v_batch_audit);
  exception when others then
    get stacked diagnostics v_error=message_text,v_state=returned_sqlstate;
  end;
  v_summary:=jsonb_build_object('batch_id',v_batch.id,'status','failed','review_status',v_batch.review_status,'row_count',v_batch.row_count,'applied_rows',0,'domain','parroquias','contract_version',1,'can_apply',true,'application_rpc_available',true,'idempotent_replay',false,'error',v_error,'sqlstate',v_state);
  update public.import_batches set status='failed',applied_rows=0,application_summary=v_summary,last_error=v_error,updated_at=now() where id=v_batch.id;
  perform public.admin_write_audit_log('import.batch.application_failed','import_batches',v_batch.id,jsonb_build_object('import_type','parroquias','error',v_error,'sqlstate',v_state,'scope_entity_id',v_batch.scope_entity_id,'canonical_records_modified',false));
  return v_summary;
end;
$$;

create or replace function app_private.admin_apply_import_batch(payload jsonb)
returns jsonb language plpgsql security definer
set search_path=public,app_private,internal,auth,pg_temp
as $$
declare v_type text; v_batch uuid:=nullif(payload->>'batch_id','')::uuid;
begin
  select import_type into v_type from public.import_batches where id=v_batch;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_type='personas' then return app_private.admin_apply_person_import_batch(payload); end if;
  if v_type='parroquias' then return app_private.admin_apply_structure_import_batch(payload); end if;
  raise exception 'Este tipo de importación todavía no tiene contrato de aplicación.' using errcode='0A000';
end;
$$;

revoke all on function app_private.admin_apply_structure_import_batch(jsonb) from public,anon,authenticated;
revoke all on function app_private.admin_apply_person_import_batch(jsonb) from public,anon,authenticated;
revoke all on function app_private.admin_apply_import_batch(jsonb) from public,anon;
grant execute on function app_private.admin_apply_import_batch(jsonb) to authenticated;
