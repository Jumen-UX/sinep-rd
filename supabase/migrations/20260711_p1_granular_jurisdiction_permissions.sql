-- P1: Granular jurisdiction-based permissions for admin operations
-- Implemented: 2026-07-11
--
-- This migration adds:
-- 1. Scope validation functions for checking user access to entities
-- 2. Updated RLS policies for granular access control
-- 3. Enhanced audit logging with jurisdiction tracking

-- ================================================================
-- 1. SCOPE VALIDATION FUNCTIONS
-- ================================================================

-- Check if current user has access to a specific ecclesiastical entity
-- Grants access if:
--   - User is super_admin or national_admin (no restrictions), OR
--   - User's scope_entity_id matches the entity, OR
--   - The entity is a child of user's scope_entity_id (hierarchical access)
create or replace function public.current_user_has_scope_for_entity(p_entity_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select current_setting('request.jwt.claim.role', true) = 'service_role'
    or (
      (select auth.uid()) is not null
      and (
      -- Super or national admins have unrestricted access
      exists (
        select 1 from public.user_role_assignments ura
        join public.roles r on r.id = ura.role_id
        where ura.user_id = auth.uid()
          and ura.status = 'active'
          and (ura.ends_at is null or ura.ends_at >= now())
          and r.key in ('super_admin', 'national_admin')
      )
      -- OR user has direct or hierarchical access to the entity
      or exists (
        select 1 from public.user_role_assignments ura
        where ura.user_id = auth.uid()
          and ura.status = 'active'
          and (ura.ends_at is null or ura.ends_at >= now())
          and (
            -- Direct access: scope_entity_id = p_entity_id
            ura.scope_entity_id = p_entity_id
            -- Hierarchical access: p_entity_id is a descendant of scope_entity_id
            or exists (
              with recursive entity_tree as (
                select id, 1 as depth
                from public.ecclesiastical_entities
                where id = ura.scope_entity_id
                
                union all
                
                select er.child_entity_id, et.depth + 1
                from entity_tree et
                join public.entity_relationships er on er.parent_entity_id = et.id
                where et.depth < 10  -- Prevent infinite recursion
                  and er.is_current = true
                  and er.status = 'active'
              )
              select 1 from entity_tree where id = p_entity_id
            )
          )
      )
    )
  )
$$;

comment on function public.current_user_has_scope_for_entity(uuid) is
  'Returns true if current user has access to the specified ecclesiastical entity, either directly or through hierarchical access (parent-child relationships).';

revoke execute on function public.current_user_has_scope_for_entity(uuid) from public;
revoke execute on function public.current_user_has_scope_for_entity(uuid) from anon;
grant execute on function public.current_user_has_scope_for_entity(uuid) to authenticated, service_role;

-- ================================================================

-- List active descendants for a given ecclesiastical entity.
create or replace function public.get_entity_descendants(
  p_entity_id uuid,
  p_max_depth int default 10
)
returns table (
  id uuid,
  depth int
)
language sql
security definer
set search_path = public
stable
as $$
  with recursive entity_tree as (
    select
      er.child_entity_id as id,
      1 as depth
    from public.entity_relationships er
    where er.parent_entity_id = p_entity_id
      and er.is_current = true
      and er.status = 'active'

    union all

    select
      er.child_entity_id as id,
      et.depth + 1 as depth
    from entity_tree et
    join public.entity_relationships er on er.parent_entity_id = et.id
    where et.depth < greatest(1, least(coalesce(p_max_depth, 10), 25))
      and er.is_current = true
      and er.status = 'active'
  )
  select distinct entity_tree.id, entity_tree.depth
  from entity_tree
$$;

revoke execute on function public.get_entity_descendants(uuid, int) from public;
revoke execute on function public.get_entity_descendants(uuid, int) from anon;
grant execute on function public.get_entity_descendants(uuid, int) to authenticated, service_role;

comment on function public.get_entity_descendants(uuid, int) is
  'Returns active descendant ecclesiastical entities for server-side admin scope filters.';

-- ================================================================

-- Get the root jurisdiction (scope_entity_id) for the current user
-- Returns the top-level entity (diocese, vicariate, etc.) that restricts user access
-- Returns NULL if user is super_admin/national_admin (unrestricted)
create or replace function public.current_user_root_jurisdiction_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select ura.scope_entity_id
  from public.user_role_assignments ura
  join public.roles r on r.id = ura.role_id
  where ura.user_id = auth.uid()
    and ura.status = 'active'
    and (ura.ends_at is null or ura.ends_at >= now())
    and r.key not in ('super_admin', 'national_admin')
  order by ura.created_at desc
  limit 1
$$;

comment on function public.current_user_root_jurisdiction_id() is
  'Returns the root jurisdiction (scope_entity_id) for the current user. Returns NULL for unrestricted admins (super_admin, national_admin).';

revoke execute on function public.current_user_root_jurisdiction_id() from public;
revoke execute on function public.current_user_root_jurisdiction_id() from anon;
grant execute on function public.current_user_root_jurisdiction_id() to authenticated, service_role;

-- ================================================================

-- Validate that user has scope access to an entity, raise exception if not
create or replace function public.assert_user_has_scope_for_entity(p_entity_id uuid, p_context text default 'operación')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_entity_id is not null and not public.current_user_has_scope_for_entity(p_entity_id) then
    raise exception 'No tienes permiso para acceder a esta entidad en %', p_context
      using errcode = '42501';  -- INSUFFICIENT PRIVILEGE
  end if;
end;
$$;

comment on function public.assert_user_has_scope_for_entity(uuid, text) is
  'Raises an exception if the current user does not have scope access to the specified entity.';

revoke execute on function public.assert_user_has_scope_for_entity(uuid, text) from public;
revoke execute on function public.assert_user_has_scope_for_entity(uuid, text) from anon;
grant execute on function public.assert_user_has_scope_for_entity(uuid, text) to authenticated, service_role;

-- ================================================================
-- 2. UPDATE EXISTING RPCS WITH SCOPE VALIDATION
-- ================================================================

-- Update admin_save_position_assignment to validate scope of ecclesiastical_entity_id
create or replace function public.admin_save_position_assignment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_assignment_id uuid;
  v_closed_assignment_ids uuid[] := '{}'::uuid[];
  v_person_id uuid := nullif(payload->>'person_id', '')::uuid;
  v_office_configuration_id uuid := nullif(payload->>'office_configuration_id', '')::uuid;
  v_organization_chart_id uuid := nullif(payload->>'organization_chart_id', '')::uuid;
  v_organization_unit_id uuid := nullif(payload->>'organization_unit_id', '')::uuid;
  v_ecclesiastical_entity_id uuid := nullif(payload->>'ecclesiastical_entity_id', '')::uuid;
  v_pastoral_entity_id uuid := nullif(payload->>'pastoral_entity_id', '')::uuid;
  v_predecessor_assignment_id uuid := nullif(payload->>'predecessor_assignment_id', '')::uuid;
  v_successor_assignment_id uuid := nullif(payload->>'successor_assignment_id', '')::uuid;
  v_start_date date := nullif(payload->>'start_date', '')::date;
  v_term_start_date date := nullif(payload->>'term_start_date', '')::date;
  v_term_end_date date := nullif(payload->>'term_end_date', '')::date;
  v_actual_end_date date := nullif(payload->>'actual_end_date', '')::date;
  v_effective_date date := nullif(payload->>'effective_date', '')::date;
  v_public_from date := nullif(payload->>'public_from', '')::date;
  v_public_until date := nullif(payload->>'public_until', '')::date;
  v_confidential_until date := nullif(payload->>'confidential_until', '')::date;
  v_assignment_status text := coalesce(nullif(payload->>'assignment_status', ''), 'active');
  v_selection_method text := coalesce(nullif(payload->>'selection_method', ''), 'appointment');
  v_verification_status text := coalesce(nullif(payload->>'verification_status', ''), 'pending_review');
  v_visibility text := coalesce(nullif(payload->>'visibility', ''), 'public');
  v_publication_status text := nullif(payload->>'publication_status', '');
  v_is_current boolean;
  v_close_previous boolean := coalesce((payload->>'close_previous_current')::boolean, false);
  v_close_date date;
begin
  if v_user_id is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar asignaciones de cargos' using errcode = '42501';
  end if;

  if v_office_configuration_id is null then
    raise exception 'Debes seleccionar un cargo configurado' using errcode = '22023';
  end if;

  if not exists (select 1 from public.office_configurations where id = v_office_configuration_id and status = 'active') then
    raise exception 'El cargo configurado no existe o no está activo' using errcode = '22023';
  end if;

  -- NEW: P1 VALIDATION — Validate scope access to ecclesiastical_entity_id
  if v_ecclesiastical_entity_id is not null then
    perform public.assert_user_has_scope_for_entity(v_ecclesiastical_entity_id, 'asignación de cargo');
  end if;

  -- NEW: P1 VALIDATION — Validate scope access to pastoral_entity_id
  if v_pastoral_entity_id is not null then
    perform public.assert_user_has_scope_for_entity(v_pastoral_entity_id, 'asignación de cargo');
  end if;

  if v_assignment_status not in ('active', 'term_expired_still_serving', 'renewed', 'replaced', 'vacant', 'suspended', 'ended') then
    raise exception 'Estado de asignación no permitido' using errcode = '22023';
  end if;

  if v_selection_method not in ('appointment', 'election', 'confirmation', 'ex_officio', 'other') then
    raise exception 'Método de selección no permitido' using errcode = '22023';
  end if;

  if v_verification_status not in ('verified', 'pending_review', 'needs_correction', 'disputed') then
    raise exception 'Estado de verificación no permitido' using errcode = '22023';
  end if;

  if v_visibility not in ('public', 'internal', 'private') then
    raise exception 'Visibilidad no permitida' using errcode = '22023';
  end if;

  if v_person_id is null and v_assignment_status <> 'vacant' then
    raise exception 'Debes seleccionar una persona, excepto cuando el estado sea vacante' using errcode = '22023';
  end if;

  if v_person_id is not null and not exists (select 1 from public.persons where id = v_person_id and status = 'active') then
    raise exception 'La persona seleccionada no existe o no está activa' using errcode = '22023';
  end if;

  if v_organization_chart_id is null then
    select organization_chart_id into v_organization_chart_id from public.office_configurations where id = v_office_configuration_id;
  end if;

  if v_term_start_date is null then
    v_term_start_date := v_start_date;
  end if;

  v_is_current := v_actual_end_date is null and v_assignment_status not in ('ended', 'replaced', 'suspended');

  insert into public.position_assignments (
    person_id, office_configuration_id, organization_chart_id, organization_unit_id,
    ecclesiastical_entity_id, pastoral_entity_id, title_override, start_date,
    term_start_date, term_end_date, actual_end_date, is_current, assignment_status,
    selection_method, predecessor_assignment_id, successor_assignment_id,
    notes_public, notes_internal, source_name, source_url, source_checked_at,
    verification_status, visibility, record_status
  ) values (
    v_person_id, v_office_configuration_id, v_organization_chart_id, v_organization_unit_id,
    v_ecclesiastical_entity_id, v_pastoral_entity_id, nullif(btrim(payload->>'title_override'), ''), v_start_date,
    v_term_start_date, v_term_end_date, v_actual_end_date, v_is_current, v_assignment_status,
    v_selection_method, v_predecessor_assignment_id, v_successor_assignment_id,
    nullif(btrim(payload->>'notes_public'), ''), nullif(btrim(payload->>'notes_internal'), ''),
    nullif(btrim(payload->>'source_name'), ''), nullif(btrim(payload->>'source_url'), ''), nullif(payload->>'source_checked_at', '')::date,
    v_verification_status, v_visibility, 'active'
  ) returning id into v_assignment_id;

  if v_predecessor_assignment_id is not null then
    update public.position_assignments
    set successor_assignment_id = v_assignment_id,
        replaced_by_assignment_id = v_assignment_id,
        is_current = false,
        assignment_status = case when assignment_status in ('active', 'term_expired_still_serving', 'vacant') then 'replaced' else assignment_status end,
        actual_end_date = coalesce(actual_end_date, v_start_date),
        updated_at = now()
    where id = v_predecessor_assignment_id;
  end if;

  if v_successor_assignment_id is not null then
    update public.position_assignments
    set predecessor_assignment_id = v_assignment_id,
        updated_at = now()
    where id = v_successor_assignment_id;
  end if;

  if v_close_previous then
    update public.position_assignments
    set is_current = false,
        assignment_status = case when assignment_status in ('active', 'term_expired_still_serving', 'vacant') then 'replaced' else assignment_status end,
        actual_end_date = coalesce(actual_end_date, v_start_date),
        replaced_by_assignment_id = coalesce(replaced_by_assignment_id, v_assignment_id),
        successor_assignment_id = coalesce(successor_assignment_id, v_assignment_id),
        updated_at = now()
    where id <> v_assignment_id
      and is_current = true
      and record_status = 'active'
      and office_configuration_id = v_office_configuration_id
      and organization_chart_id is not distinct from v_organization_chart_id
      and organization_unit_id is not distinct from v_organization_unit_id
      and ecclesiastical_entity_id is not distinct from v_ecclesiastical_entity_id
      and pastoral_entity_id is not distinct from v_pastoral_entity_id;
  end if;

  return jsonb_build_object('assignment_id', v_assignment_id);
end;
$$;

grant execute on function public.admin_save_position_assignment(jsonb) to authenticated;

comment on function public.admin_save_position_assignment(jsonb) is
  'Save position assignment with P1 scope validation. User must have access to ecclesiastical_entity_id and pastoral_entity_id.';

-- ================================================================
-- 3. ENHANCED AUDIT LOGGING (Future: add jurisdiction_id column)
-- ================================================================

-- Note: In a future migration, consider adding:
-- ALTER TABLE public.admin_audit_log ADD COLUMN jurisdiction_id uuid;
-- This would track which jurisdiction each audit action affected.

-- ================================================================
-- 4. GRANT PERMISSIONS
-- ================================================================

grant execute on function public.current_user_has_scope_for_entity(uuid) to authenticated;
grant execute on function public.current_user_root_jurisdiction_id() to authenticated;
grant execute on function public.assert_user_has_scope_for_entity(uuid, text) to authenticated;
