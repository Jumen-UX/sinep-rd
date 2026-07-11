begin;

create or replace function app_private.admin_review_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_batch_id uuid := nullif(payload ->> 'batch_id', '')::uuid;
  v_decision text := lower(nullif(btrim(payload ->> 'decision'), ''));
  v_notes text := nullif(btrim(payload ->> 'notes'), '');
  v_batch public.import_batches%rowtype;
  v_audit_log_id uuid;
  v_application_available boolean := false;
  v_can_apply boolean := false;
begin
  if v_actor_id is null then
    raise exception 'No autenticado para revisar importaciones.' using errcode = '42501';
  end if;

  if not public.current_user_has_permission('imports.review')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para revisar importaciones.' using errcode = '42501';
  end if;

  if v_batch_id is null then
    raise exception 'El lote de importación es obligatorio.' using errcode = '22023';
  end if;

  if v_decision not in ('approved', 'rejected') then
    raise exception 'La decisión debe ser approved o rejected.' using errcode = '22023';
  end if;

  select * into v_batch
  from public.import_batches
  where id = v_batch_id
  for update;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  if v_batch.scope_entity_id is not null
     and not public.current_user_can_manage_entity('imports.review', v_batch.scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance de revisión.' using errcode = '42501';
  end if;

  if v_batch.status <> 'validated' then
    raise exception 'Solo se pueden revisar lotes completamente validados.' using errcode = '22023';
  end if;

  if v_decision = 'approved'
     and (v_batch.error_rows + v_batch.duplicate_rows + v_batch.unresolved_rows) > 0 then
    raise exception 'El lote mantiene incidencias bloqueantes y no puede aprobarse.' using errcode = '22023';
  end if;

  if v_decision = 'rejected' and v_notes is null then
    raise exception 'Debes indicar el motivo del rechazo.' using errcode = '22023';
  end if;

  update public.import_batches
  set review_status = v_decision,
      review_notes = v_notes,
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      updated_at = now()
  where id = v_batch_id;

  v_application_available := v_batch.import_type = 'personas';
  v_can_apply := v_decision = 'approved'
    and v_application_available
    and (
      public.current_user_is_super_or_national()
      or (
        public.current_user_has_permission('imports.apply')
        and v_batch.scope_entity_id is not null
        and public.current_user_can_manage_entity('imports.apply', v_batch.scope_entity_id)
      )
    );

  v_audit_log_id := public.admin_write_audit_log(
    'import.batch.reviewed',
    'import_batches',
    v_batch_id,
    jsonb_build_object(
      'decision', v_decision,
      'notes_provided', v_notes is not null,
      'scope_entity_id', v_batch.scope_entity_id,
      'row_count', v_batch.row_count,
      'application_rpc_available', v_application_available,
      'canonical_records_modified', false
    )
  );

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'status', v_batch.status,
    'review_status', v_decision,
    'reviewed_at', now(),
    'can_apply', v_can_apply,
    'application_rpc_available', v_application_available,
    'audit_log_id', v_audit_log_id
  );
end;
$$;

revoke all on function app_private.admin_review_import_batch(jsonb) from public, anon;
grant execute on function app_private.admin_review_import_batch(jsonb) to authenticated;

create or replace function public.admin_review_import_batch(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = public, app_private, auth, pg_temp
as $$
  select app_private.admin_review_import_batch(payload);
$$;

revoke all on function public.admin_review_import_batch(jsonb) from public, anon;
grant execute on function public.admin_review_import_batch(jsonb) to authenticated;

commit;