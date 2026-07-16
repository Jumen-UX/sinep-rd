begin;
create or replace function app_private.admin_apply_import_batch(payload jsonb)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','app_private','internal','auth','pg_temp' as $$
declare v_actor uuid:=auth.uid(); v_type text; v_batch uuid:=nullif(payload->>'batch_id','')::uuid; v_projection jsonb; v_total int; v_create int; v_noop int; v_update int;
begin
 if v_actor is null then raise exception 'No autenticado para aplicar importaciones.' using errcode='42501'; end if;
 if not public.current_user_has_permission('imports.apply') and not public.current_user_is_super_or_national() then raise exception 'No autorizado para aplicar importaciones.' using errcode='42501'; end if;
 select import_type into v_type from public.import_batches where id=v_batch;
 if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
 v_projection:=app_private.import_application_preflight(v_batch);
 v_total:=(v_projection->>'total_rows')::int; v_create:=(v_projection->>'create_rows')::int; v_update:=(v_projection->>'update_rows')::int; v_noop:=(v_projection->>'noop_rows')::int;
 if v_noop=v_total then return app_private.admin_apply_noop_import_batch(payload); end if;
 if v_update=v_total and v_type='eventos' then return app_private.admin_apply_event_update_import_batch(payload); end if;
 if v_create>0 and v_noop>0 and v_create+v_noop=v_total then return app_private.admin_apply_mixed_import_batch(payload); end if;
 if v_noop>0 or v_update>0 then raise exception 'El lote contiene una combinación de operaciones todavía no soportada.' using errcode='0A000'; end if;
 if v_type='personas' then return app_private.admin_apply_person_import_batch(payload); end if;
 if v_type='parroquias' then return app_private.admin_apply_structure_import_batch(payload); end if;
 if v_type='asignaciones' then return app_private.admin_apply_assignment_import_batch(payload); end if;
 if v_type='eventos' then return app_private.admin_apply_event_import_batch(payload); end if;
 raise exception 'Este tipo de importación todavía no tiene contrato de aplicación.' using errcode='0A000';
end;$$;
revoke all on function app_private.admin_apply_import_batch(jsonb) from public,anon,authenticated;
grant execute on function app_private.admin_apply_import_batch(jsonb) to service_role;
commit;