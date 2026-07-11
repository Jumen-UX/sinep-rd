begin;

create or replace function app_private.finalize_event_import_validation(p_batch_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,app_private,internal,auth,pg_temp
as $$
declare
 v_batch public.import_batches%rowtype; v_row public.import_batch_rows%rowtype;
 v_entity uuid; v_type text; v_type_id uuid; v_date date; v_title text;
 v_valid int; v_warning int; v_error int; v_duplicate int; v_unresolved int; v_status text; v_summary jsonb;
begin
 select * into v_batch from public.import_batches where id=p_batch_id for update;
 if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
 if v_batch.import_type<>'eventos' then return v_batch.validation_summary; end if;
 for v_row in select * from public.import_batch_rows where batch_id=p_batch_id order by row_number loop
  v_entity:=nullif(v_row.resolved_relations->>'entidad','')::uuid;
  v_type:=lower(btrim(coalesce(v_row.normalized_data->>'tipo_evento','')));
  v_date:=nullif(v_row.normalized_data->>'fecha_efectiva','')::date;
  v_title:=nullif(btrim(v_row.normalized_data->>'titulo'),'');
  select id into v_type_id from public.canonical_event_types where key=v_type and is_active=true;
  if v_type_id is null then
   insert into public.import_batch_row_issues(batch_id,row_id,issue_type,code,field_name,message,details)
   values(p_batch_id,v_row.id,'validation_error','unsupported_canonical_event_type','tipo_evento','El tipo de evento no tiene contrato canónico activo.',jsonb_build_object('received',v_type));
  end if;
  if v_entity is not null and v_type_id is not null and v_date is not null and exists(
   select 1 from public.canonical_events ce join public.canonical_event_participants cep on cep.event_id=ce.id and cep.entity_id=v_entity
   where ce.event_type_id=v_type_id and coalesce(ce.effective_date,ce.event_date)=v_date and ce.status<>'cancelled') then
   insert into public.import_batch_row_issues(batch_id,row_id,issue_type,code,field_name,message,details)
   values(p_batch_id,v_row.id,'duplicate','existing_canonical_event','entidad','Ya existe un evento canónico del mismo tipo, entidad y fecha efectiva.',jsonb_build_object('entity_id',v_entity,'event_type_key',v_type,'effective_date',v_date));
  end if;
  update public.import_batch_rows set target_operation='create',target_schema='public',target_table='canonical_events',
   resolved_relations=resolved_relations||jsonb_build_object('canonical_event_type_id',v_type_id,'canonical_event_type_key',v_type,'generated_title',coalesce(v_title,initcap(replace(v_type,'_',' '))||' — '||coalesce(v_row.normalized_data->>'entidad','Evento importado'))),updated_at=now()
  where id=v_row.id;
 end loop;
 update public.import_batch_rows r set status=case
  when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='validation_error') then 'error'
  when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='duplicate') then 'duplicate'
  when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='unresolved_relation') then 'unresolved'
  when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='warning') then 'warning' else 'valid' end,updated_at=now()
 where r.batch_id=p_batch_id;
 select count(*) filter(where status='valid'),count(*) filter(where status='warning'),count(*) filter(where status='error'),count(*) filter(where status='duplicate'),count(*) filter(where status='unresolved')
 into v_valid,v_warning,v_error,v_duplicate,v_unresolved from public.import_batch_rows where batch_id=p_batch_id;
 v_status:=case when v_error+v_duplicate+v_unresolved>0 then 'needs_review' else 'validated' end;
 v_summary:=jsonb_build_object('batch_id',p_batch_id,'status',v_status,'row_count',v_batch.row_count,'valid_rows',v_valid,'warning_rows',v_warning,'error_rows',v_error,'duplicate_rows',v_duplicate,'unresolved_rows',v_unresolved,'can_apply',false,'application_rpc_available',true,'application_domain','eventos','application_effect','create_pending_review_event_records_only');
 update public.import_batches set status=v_status,valid_rows=v_valid,warning_rows=v_warning,error_rows=v_error,duplicate_rows=v_duplicate,unresolved_rows=v_unresolved,validation_summary=v_summary,updated_at=now() where id=p_batch_id;
 return v_summary;
end;$$;

revoke all on function app_private.finalize_event_import_validation(uuid) from public,anon,authenticated;

commit;
