-- P1 Phase 3: Update admin_write_audit_log RPC to include jurisdiction_id
-- Applied: 2026-07-11

drop function if exists public.admin_write_audit_log(text, text, uuid, jsonb);

create or replace function public.admin_write_audit_log(
  p_action text,
  p_target_table text default null,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_jurisdiction_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_jurisdiction_id uuid := p_jurisdiction_id;
  v_is_service_role boolean := current_setting('request.jwt.claim.role', true) = 'service_role';
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_audit_id uuid;
begin
  if not v_is_service_role and (v_user_id is null or not public.current_user_has_admin_role()) then
    raise exception 'No autorizado para registrar auditoria' using errcode = '42501';
  end if;

  if nullif(btrim(p_action), '') is null then
    raise exception 'La accion de auditoria es obligatoria' using errcode = '22023';
  end if;

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'La metadata de auditoria debe ser un objeto JSON' using errcode = '22023';
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
    coalesce(v_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    btrim(p_action),
    nullif(btrim(p_target_table), ''),
    p_target_id,
    v_metadata,
    v_jurisdiction_id,
    now()
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;

revoke execute on function public.admin_write_audit_log(text, text, uuid, jsonb, uuid) from public;
revoke execute on function public.admin_write_audit_log(text, text, uuid, jsonb, uuid) from anon;
grant execute on function public.admin_write_audit_log(text, text, uuid, jsonb, uuid) to authenticated, service_role;

comment on function public.admin_write_audit_log(text, text, uuid, jsonb, uuid) is
  'Record administrative audit event with optional jurisdiction_id. If not provided, derives from target table/id.';
