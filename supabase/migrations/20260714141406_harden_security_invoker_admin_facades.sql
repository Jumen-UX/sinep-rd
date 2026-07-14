-- Keep the API-facing RPC names stable while removing SECURITY DEFINER
-- from the exposed public-schema facades. Privileged work remains in
-- app_private functions with explicit authentication and permission checks.

create or replace function app_private.admin_apply_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'app_private', 'internal', 'auth', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_type text;
  v_batch uuid := nullif(payload ->> 'batch_id', '')::uuid;
  v_total integer;
  v_create integer;
  v_noop integer;
  v_update integer;
begin
  if v_actor is null then
    raise exception 'No autenticado para aplicar importaciones.' using errcode = '42501';
  end if;

  if not public.current_user_has_permission('imports.apply')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para aplicar importaciones.' using errcode = '42501';
  end if;

  select import_type
    into v_type
  from public.import_batches
  where id = v_batch;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  select
    count(*),
    count(*) filter (where target_operation = 'create'),
    count(*) filter (where target_operation = 'noop'),
    count(*) filter (where target_operation = 'update')
  into v_total, v_create, v_noop, v_update
  from public.import_batch_rows
  where batch_id = v_batch;

  if v_total > 0 and v_noop = v_total then
    return app_private.admin_apply_noop_import_batch(payload);
  end if;

  if v_total > 0 and v_update = v_total and v_type = 'eventos' then
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
$function$;

create or replace function app_private.validate_import_batch_with_contract(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $function$
declare
  v_actor uuid := auth.uid();
  v_summary jsonb;
  v_import_type text;
  v_status text;
begin
  if v_actor is null then
    raise exception 'No autenticado para validar importaciones.' using errcode = '42501';
  end if;

  if not public.current_user_has_permission('imports.prepare')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para validar importaciones.' using errcode = '42501';
  end if;

  select import_type, status
    into v_import_type, v_status
  from public.import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  if v_status in ('applying', 'applied', 'cancelled') then
    raise exception 'El lote ya no admite revalidación.' using errcode = '22023';
  end if;

  v_summary := app_private.validate_import_batch(p_batch_id);

  if v_import_type = 'personas' then
    perform app_private.finalize_person_import_validation(p_batch_id);
    return app_private.promote_person_reference_matches_to_noop(p_batch_id);
  end if;

  if v_import_type = 'parroquias' then
    perform app_private.finalize_structure_import_validation(p_batch_id);
    return app_private.promote_exact_structure_matches_to_noop(p_batch_id);
  end if;

  if v_import_type = 'asignaciones' then
    perform app_private.finalize_assignment_import_validation(p_batch_id);
    return app_private.promote_exact_import_matches_to_noop(p_batch_id);
  end if;

  if v_import_type = 'eventos' then
    perform app_private.finalize_event_import_validation(p_batch_id);
    perform app_private.promote_exact_import_matches_to_noop(p_batch_id);
    return app_private.classify_event_import_updates(p_batch_id);
  end if;

  return v_summary;
end;
$function$;

create or replace function public.admin_apply_import_batch(payload jsonb)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'app_private', 'internal', 'auth', 'pg_temp'
as $function$
  select app_private.admin_apply_import_batch(payload)
$function$;

create or replace function public.admin_validate_import_batch(p_batch_id uuid)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.validate_import_batch_with_contract(p_batch_id)
$function$;

create or replace function public.admin_save_organization_unit(payload jsonb)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'app_private', 'internal', 'auth', 'pg_temp'
as $function$
  select app_private.rpc_definer__admin_save_organization_unit(payload)
$function$;

create or replace function public.admin_apply_organization_unit_event(payload jsonb)
returns jsonb
language sql
security invoker
set search_path to 'pg_catalog', 'public', 'app_private', 'internal', 'auth', 'pg_temp'
as $function$
  select app_private.rpc_definer__admin_apply_organization_unit_event(payload)
$function$;

revoke all on function public.admin_apply_import_batch(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.admin_validate_import_batch(uuid) from public, anon, authenticated, service_role;
revoke all on function public.admin_save_organization_unit(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.admin_apply_organization_unit_event(jsonb) from public, anon, authenticated, service_role;

grant execute on function public.admin_apply_import_batch(jsonb) to authenticated, service_role;
grant execute on function public.admin_validate_import_batch(uuid) to authenticated, service_role;
grant execute on function public.admin_save_organization_unit(jsonb) to authenticated, service_role;
grant execute on function public.admin_apply_organization_unit_event(jsonb) to authenticated, service_role;

revoke all on function app_private.admin_apply_import_batch(jsonb) from public, anon, authenticated, service_role;
revoke all on function app_private.validate_import_batch_with_contract(uuid) from public, anon, authenticated, service_role;
revoke all on function app_private.rpc_definer__admin_save_organization_unit(jsonb) from public, anon, authenticated, service_role;
revoke all on function app_private.rpc_definer__admin_apply_organization_unit_event(jsonb) from public, anon, authenticated, service_role;

grant execute on function app_private.admin_apply_import_batch(jsonb) to authenticated, service_role;
grant execute on function app_private.validate_import_batch_with_contract(uuid) to authenticated, service_role;
grant execute on function app_private.rpc_definer__admin_save_organization_unit(jsonb) to authenticated, service_role;
grant execute on function app_private.rpc_definer__admin_apply_organization_unit_event(jsonb) to authenticated, service_role;
