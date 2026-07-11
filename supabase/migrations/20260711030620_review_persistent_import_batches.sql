-- Add an explicit editorial review decision before any future canonical application.

begin;

insert into public.permissions (key, module, description)
values (
  'imports.review',
  'imports',
  'Aprobar o rechazar lotes de importación validados dentro del alcance administrativo asignado.'
)
on conflict (key) do update
set module = excluded.module,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select role_row.id, permission_row.id
from public.roles role_row
cross join public.permissions permission_row
where role_row.key in ('super_admin', 'national_admin', 'diocesan_admin')
  and permission_row.key = 'imports.review'
on conflict do nothing;

alter table public.import_batches
  add column if not exists review_status text not null default 'pending',
  add column if not exists review_notes text;

alter table public.import_batches
  drop constraint if exists import_batches_review_status_check;

alter table public.import_batches
  add constraint import_batches_review_status_check
  check (review_status in ('pending', 'approved', 'rejected'));

create index if not exists idx_import_batches_review_status
  on public.import_batches (review_status, status, created_at desc);

create or replace function app_private.reset_import_batch_review_on_validation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.validated_at is distinct from old.validated_at then
    new.review_status := 'pending';
    new.review_notes := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function app_private.reset_import_batch_review_on_validation() from public, anon, authenticated;

drop trigger if exists import_batches_reset_review_after_validation on public.import_batches;
create trigger import_batches_reset_review_after_validation
before update on public.import_batches
for each row
execute function app_private.reset_import_batch_review_on_validation();

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

  v_audit_log_id := public.admin_write_audit_log(
    'import.batch.reviewed',
    'import_batches',
    v_batch_id,
    jsonb_build_object(
      'decision', v_decision,
      'notes_provided', v_notes is not null,
      'scope_entity_id', v_batch.scope_entity_id,
      'row_count', v_batch.row_count,
      'canonical_records_modified', false
    )
  );

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'status', v_batch.status,
    'review_status', v_decision,
    'reviewed_at', now(),
    'can_apply', false,
    'application_rpc_available', false,
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

comment on column public.import_batches.review_status is
  'Independent editorial decision. Approval never applies canonical records by itself.';
comment on function public.admin_review_import_batch(jsonb) is
  'Approves or rejects a validated import batch without applying canonical records.';

commit;
