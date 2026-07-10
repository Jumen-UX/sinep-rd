-- Restore the administrative audit pipeline used by server routes and the admin dashboard.

create or replace function public.admin_write_audit_log(
  p_action text,
  p_target_table text default null,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_log_id uuid;
  v_action text := nullif(btrim(p_action), '');
  v_target_table text := coalesce(nullif(btrim(p_target_table), ''), 'administrative_action');
begin
  if v_actor_id is null then
    raise exception 'No autenticado para registrar auditoría.' using errcode = '42501';
  end if;

  if not public.current_user_has_admin_role() then
    raise exception 'No autorizado para registrar auditoría administrativa.' using errcode = '42501';
  end if;

  if v_action is null then
    raise exception 'La acción de auditoría es obligatoria.' using errcode = '22023';
  end if;

  insert into public.audit_logs (
    user_id,
    action,
    target_table,
    target_id,
    new_data
  ) values (
    v_actor_id,
    v_action,
    v_target_table,
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

revoke all on function public.admin_write_audit_log(text, text, uuid, jsonb) from public, anon;
grant execute on function public.admin_write_audit_log(text, text, uuid, jsonb) to authenticated;

create or replace view public.admin_audit_log
with (security_invoker = true)
as
select
  al.id,
  al.user_id as actor_user_id,
  al.action,
  al.target_table,
  al.target_id,
  coalesce(al.new_data, '{}'::jsonb) as metadata,
  al.created_at
from public.audit_logs al;

revoke all on table public.admin_audit_log from public, anon;
grant select on table public.admin_audit_log to authenticated;

create index if not exists idx_audit_logs_created_at_desc
  on public.audit_logs (created_at desc);

create index if not exists idx_audit_logs_target
  on public.audit_logs (target_table, target_id, created_at desc);

comment on function public.admin_write_audit_log(text, text, uuid, jsonb)
  is 'Writes an authenticated administrative audit event using the caller identity.';

comment on view public.admin_audit_log
  is 'RLS-aware administrative audit feed consumed by the admin dashboard.';
