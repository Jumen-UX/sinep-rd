-- P1 Phase 3: Enhanced audit logging with jurisdiction tracking
-- Applied: 2026-07-11
--
-- This migration adds:
-- 1. jurisdiction_id column to admin_audit_log for tracking which jurisdiction was affected
-- 2. Helper function to auto-populate jurisdiction_id based on user's scope

-- ================================================================
-- 1. ADD jurisdiction_id COLUMN TO admin_audit_log
-- ================================================================

alter table public.admin_audit_log
add column jurisdiction_id uuid null,
add constraint admin_audit_log_jurisdiction_id_fkey
  foreign key (jurisdiction_id)
  references public.ecclesiastical_entities(id)
  on delete set null;

create index idx_admin_audit_log_jurisdiction_id
  on public.admin_audit_log(jurisdiction_id);

comment on column public.admin_audit_log.jurisdiction_id is
  'The ecclesiastical entity (jurisdiction) affected by this action. Auto-populated from user scope if applicable.';

-- ================================================================
-- 2. HELPER FUNCTION: Get jurisdiction for audit
-- ================================================================

create or replace function public.admin_audit_get_jurisdiction_for_entity(
  p_target_table text,
  p_target_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_jurisdiction_id uuid;
begin
  -- Try to find jurisdiction based on table and record
  case p_target_table
    -- position_assignments -> ecclesiastical_entity_id
    when 'position_assignments' then
      select ecclesiastical_entity_id into v_jurisdiction_id
      from public.position_assignments
      where id = p_target_id;

    -- ecclesiastical_entities -> self
    when 'ecclesiastical_entities' then
      select id into v_jurisdiction_id
      from public.ecclesiastical_entities
      where id = p_target_id;

    -- persons -> via clergy_profiles -> incardination_entity_id
    when 'persons' then
      select incardination_entity_id into v_jurisdiction_id
      from public.clergy_profiles
      where person_id = p_target_id
      limit 1;

    -- office_configurations -> via position_assignments
    when 'office_configurations' then
      select distinct ecclesiastical_entity_id into v_jurisdiction_id
      from public.position_assignments
      where office_configuration_id = p_target_id
      limit 1;
  end case;

  return v_jurisdiction_id;
end;
$$;

grant execute on function public.admin_audit_get_jurisdiction_for_entity(text, uuid) to authenticated, service_role;

comment on function public.admin_audit_get_jurisdiction_for_entity(text, uuid) is
  'Derives the jurisdiction (ecclesiastical_entity_id) for a given table record to populate admin_audit_log.jurisdiction_id.';

-- ================================================================
-- 3. UPDATE recordAdminAudit TO POPULATE jurisdiction_id
-- ================================================================

-- This is handled via src/lib/admin/audit.ts
-- The TypeScript function will call admin_audit_get_jurisdiction_for_entity
-- and pass jurisdiction_id when inserting audit log

comment on table public.admin_audit_log is
  'Audit trail for administrative actions. Now includes jurisdiction_id to track which ecclesiastical entity was affected.
   This enables:
   - Compliance reporting: Which diocese was affected by which admin
   - Scope validation: Ensure actions are within user jurisdiction
   - Historical tracking: Complete action trail with jurisdiction context';

-- ================================================================
-- 4. INDEX FOR AUDIT QUERIES
-- ================================================================

create index idx_admin_audit_log_actor_jurisdiction
  on public.admin_audit_log(actor_user_id, jurisdiction_id, created_at desc);

create index idx_admin_audit_log_action_jurisdiction
  on public.admin_audit_log(action, jurisdiction_id, created_at desc);

-- ================================================================
-- 5. VIEW: Audit log with jurisdiction details
-- ================================================================

create or replace view public.admin_audit_log_with_jurisdiction as
select
  aal.id,
  aal.actor_user_id,
  aal.action,
  aal.target_table,
  aal.target_id,
  aal.metadata,
  aal.created_at,
  aal.jurisdiction_id,
  ee.name as jurisdiction_name,
  ee.slug as jurisdiction_slug,
  ee.entity_type_id
from public.admin_audit_log aal
left join public.ecclesiastical_entities ee on ee.id = aal.jurisdiction_id;

grant select on public.admin_audit_log_with_jurisdiction to authenticated;

comment on view public.admin_audit_log_with_jurisdiction is
  'Audit log enhanced with jurisdiction details for easier reporting and filtering.';

-- ================================================================
-- 6. STORED PROCEDURE: Query audit by jurisdiction
-- ================================================================

create or replace function public.admin_audit_log_by_jurisdiction(
  p_jurisdiction_id uuid,
  p_limit_rows int default 100
)
returns table (
  id uuid,
  actor_user_id uuid,
  action text,
  target_table text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz,
  jurisdiction_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_has_admin_role() then
    raise exception 'No autorizado para consultar auditoría' using errcode = '42501';
  end if;

  if p_jurisdiction_id is not null then
    perform public.assert_user_has_scope_for_entity(p_jurisdiction_id, 'consulta de auditoría');
  end if;

  return query
  select
    aal.id,
    aal.actor_user_id,
    aal.action,
    aal.target_table,
    aal.target_id,
    aal.metadata,
    aal.created_at,
    ee.name as jurisdiction_name
  from public.admin_audit_log aal
  left join public.ecclesiastical_entities ee on ee.id = aal.jurisdiction_id
  where (p_jurisdiction_id is null or aal.jurisdiction_id = p_jurisdiction_id)
  order by aal.created_at desc
  limit p_limit_rows;
end;
$$;

grant execute on function public.admin_audit_log_by_jurisdiction(uuid, int) to authenticated;

comment on function public.admin_audit_log_by_jurisdiction(uuid, int) is
  'Query audit logs filtered by jurisdiction, respecting user scope. Validates that user has access to requested jurisdiction.';

-- ================================================================
-- 7. POLICY: Users can only view audit logs for their jurisdiction
-- ================================================================

create policy admin_audit_log_jurisdiction_check
  on public.admin_audit_log
  for select
  using (
    current_user_has_admin_role()
    and (
      jurisdiction_id is null
      or current_user_has_scope_for_entity(jurisdiction_id)
    )
  );
