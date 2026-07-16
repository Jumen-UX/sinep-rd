begin;
create or replace function app_private.import_application_preflight(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path=public,app_private,auth,pg_temp as $$
declare v_batch public.import_batches%rowtype; v_total int; v_create int; v_update int; v_noop int;
begin
 select * into v_batch from public.import_batches where id=p_batch_id for update;
 if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
 select count(*),count(*) filter(where target_operation='create'),count(*) filter(where target_operation='update'),count(*) filter(where target_operation='noop')
 into v_total,v_create,v_update,v_noop from public.import_batch_rows where batch_id=p_batch_id;
 if v_total=0 or v_total<>v_batch.row_count then raise exception 'La cantidad de filas persistidas no coincide con el resumen del lote.' using errcode='22023'; end if;
 if exists(select 1 from public.import_batch_row_issues where batch_id=p_batch_id and status='open' and issue_type in ('validation_error','duplicate','unresolved_relation')) then raise exception 'El lote mantiene incidencias bloqueantes.' using errcode='22023'; end if;
 if exists(select 1 from public.import_batch_rows r where r.batch_id=p_batch_id and (r.status not in ('valid','warning') or r.target_operation not in ('create','update','noop') or coalesce(r.target_schema,'public')<>'public' or r.target_table is null or (r.target_operation='create' and r.target_record_id is not null) or (r.target_operation in ('update','noop') and r.target_record_id is null))) then raise exception 'La proyección de aplicación contiene filas bloqueadas o no resueltas.' using errcode='22023'; end if;
 return jsonb_build_object('batch_id',p_batch_id,'total_rows',v_total,'create_rows',v_create,'update_rows',v_update,'noop_rows',v_noop);
end;$$;
revoke all on function app_private.import_application_preflight(uuid) from public,anon,authenticated;
commit;