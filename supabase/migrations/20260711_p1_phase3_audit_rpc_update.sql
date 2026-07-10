-- P1 Phase 3: Update admin_write_audit_log RPC to include jurisdiction_id
-- Applied: 2026-07-11

create or replace function public.admin_write_audit_log(
  p_action text,
  p_target_table text default null,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_jurisdiction_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_jurisdiction_id uuid := p_jurisdiction_id;
begin
  if v_user_id is null then
    return; -- Silent fail for non-authenticated users
  end if;

  -- If jurisdiction_id not provided, try to derive it from target table/id
  if v_jurisdiction_id is null and p_target_table is not null and p_target_id is not null then
    v_jurisdiction_id := public.admin_audit_get_jurisdiction_for_entity(p_target_table, p_target_id);
  end if;

  insert into public.admin_audit_log (
    actor_user_id,
    action,
    target_table,
    target_id,
    metadata,
    jurisdiction_id,
    created_at
  ) values (
    v_user_id,
    p_action,
    p_target_table,
    p_target_id,
    p_metadata,
    v_jurisdiction_id,
    now()
  );
end;
$$;

grant execute on function public.admin_write_audit_log(text, text, uuid, jsonb, uuid) to authenticated, service_role;

comment on function public.admin_write_audit_log(text, text, uuid, jsonb, uuid) is
  'Record administrative audit event with optional jurisdiction_id. If not provided, derives from target table/id.';
