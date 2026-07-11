create or replace function app_private.admin_apply_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,app_private,internal,auth,pg_temp
as $$
declare
 v_type text;
 v_batch uuid:=nullif(payload->>'batch_id','')::uuid;
 v_total integer;
 v_create integer;
 v_noop integer;
begin
 select import_type into v_type from public.import_batches where id=v_batch;
 if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
 select count(*),count(*) filter(where target_operation='create'),count(*) filter(where target_operation='noop')
 into v_total,v_create,v_noop from public.import_batch_rows where batch_id=v_batch;
 if v_total>0 and v_noop=v_total then return app_private.admin_apply_noop_import_batch(payload); end if;
 if v_create>0 and v_noop>0 and v_create+v_noop=v_total then return app_private.admin_apply_mixed_import_batch(payload); end if;
 if v_noop>0 then raise exception 'El lote contiene una combinación de operaciones no soportada.' using errcode='0A000'; end if;
 if v_type='personas' then return app_private.admin_apply_person_import_batch(payload); end if;
 if v_type='parroquias' then return app_private.admin_apply_structure_import_batch(payload); end if;
 if v_type='asignaciones' then return app_private.admin_apply_assignment_import_batch(payload); end if;
 if v_type='eventos' then return app_private.admin_apply_event_import_batch(payload); end if;
 raise exception 'Este tipo de importación todavía no tiene contrato de aplicación.' using errcode='0A000';
end;$$;
revoke all on function app_private.admin_apply_import_batch(jsonb) from public,anon,authenticated;
