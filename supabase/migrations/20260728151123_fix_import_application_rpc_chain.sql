begin;

create or replace function app_private.admin_apply_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private, internal, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_type text;
  v_batch_id uuid := app_private.audit_json_uuid(payload, 'batch_id');
  v_scope_entity_id uuid;
  v_projection jsonb;
  v_total integer;
  v_create integer;
  v_noop integer;
  v_update integer;
begin
  if v_actor is null
     or not app_private.current_user_has_permission('imports.apply') then
    raise exception 'No autorizado para aplicar importaciones.' using errcode = '42501';
  end if;

  select batch_row.import_type, batch_row.scope_entity_id
  into v_type, v_scope_entity_id
  from public.import_batches batch_row
  where batch_row.id = v_batch_id;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_manage_entity('imports.apply', v_scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance de aplicación.' using errcode = '42501';
  end if;

  v_projection := app_private.import_application_preflight(v_batch_id);
  v_total := (v_projection->>'total_rows')::integer;
  v_create := (v_projection->>'create_rows')::integer;
  v_update := (v_projection->>'update_rows')::integer;
  v_noop := (v_projection->>'noop_rows')::integer;

  if v_noop = v_total then
    return app_private.admin_apply_noop_import_batch(payload);
  end if;

  if v_update = v_total and v_type = 'eventos' then
    return app_private.admin_apply_event_update_import_batch(payload);
  end if;

  if v_create > 0 and v_noop > 0 and v_create + v_noop = v_total then
    return app_private.admin_apply_mixed_import_batch(payload);
  end if;

  if v_noop > 0 or v_update > 0 then
    raise exception 'El lote contiene una combinación de operaciones todavía no soportada.' using errcode = '0A000';
  end if;

  if v_type = 'personas' then
    return app_private.admin_apply_person_import_batch(payload);
  end if;
  if v_type = 'parroquias' then
    return app_private.admin_apply_structure_import_batch(payload);
  end if;
  if v_type = 'asignaciones' then
    return app_private.admin_apply_assignment_import_batch(payload);
  end if;
  if v_type = 'eventos' then
    return app_private.admin_apply_event_import_batch(payload);
  end if;

  raise exception 'Este tipo de importación todavía no tiene contrato de aplicación.' using errcode = '0A000';
end;
$$;

revoke all on function app_private.admin_apply_import_batch(jsonb)
from public, anon, authenticated;

create or replace function public.admin_apply_import_batch(payload jsonb)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, app_private, internal, auth, pg_temp
as $$
  select app_private.admin_apply_import_batch(payload)
$$;

revoke all on function public.admin_apply_import_batch(jsonb) from public, anon, authenticated;
grant execute on function public.admin_apply_import_batch(jsonb) to authenticated;

comment on function public.admin_apply_import_batch(jsonb) is
  'Sealed authenticated facade. The private dispatcher requires imports.apply and canonical scope_entity_id before domain dispatch.';

commit;
