-- Admin audit trail for sensitive back-office actions.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_log_action_not_blank check (length(btrim(action)) > 0),
  constraint admin_audit_log_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

create index if not exists admin_audit_log_actor_user_id_idx
  on public.admin_audit_log (actor_user_id, created_at desc);

create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log (target_table, target_id);

alter table public.admin_audit_log enable row level security;

drop policy if exists admin_audit_log_select_admin on public.admin_audit_log;
create policy admin_audit_log_select_admin
on public.admin_audit_log
for select
to authenticated
using ((select public.current_user_has_admin_role()));

revoke all on table public.admin_audit_log from anon;
grant select on table public.admin_audit_log to authenticated;

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
  v_actor_user_id uuid := auth.uid();
  v_audit_id uuid;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  if v_actor_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para registrar auditoria' using errcode = '42501';
  end if;

  if nullif(btrim(p_action), '') is null then
    raise exception 'La accion de auditoria es obligatoria' using errcode = '22023';
  end if;

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'La metadata de auditoria debe ser un objeto JSON' using errcode = '22023';
  end if;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    target_table,
    target_id,
    metadata
  ) values (
    v_actor_user_id,
    btrim(p_action),
    nullif(btrim(p_target_table), ''),
    p_target_id,
    v_metadata
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;

revoke execute on function public.admin_write_audit_log(text, text, uuid, jsonb) from public;
revoke execute on function public.admin_write_audit_log(text, text, uuid, jsonb) from anon;
grant execute on function public.admin_write_audit_log(text, text, uuid, jsonb) to authenticated;
