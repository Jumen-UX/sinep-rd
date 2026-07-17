-- Scoped administrative KPI aggregation for entity-based scopes.
-- This first contract supports diocese, parish and generic entity scopes only.

create or replace function public.get_admin_contextual_kpis(
  p_scope_type text,
  p_scope_entity_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_entity_ids uuid[];
  v_active_entities bigint;
  v_active_parishes bigint;
  v_active_assignments bigint;
  v_pending_reviews bigint;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_scope_type not in ('diocese', 'parish', 'entity') then
    raise exception 'UNSUPPORTED_SCOPE_TYPE' using errcode = '22023';
  end if;

  if p_scope_entity_id is null then
    raise exception 'SCOPE_ENTITY_REQUIRED' using errcode = '22023';
  end if;

  if not public.current_user_has_scope_for_entity(p_scope_entity_id) then
    raise exception 'SCOPE_FORBIDDEN' using errcode = '42501';
  end if;

  select array_agg(scope_entity_id)
  into v_entity_ids
  from (
    select p_scope_entity_id as scope_entity_id
    union
    select descendant.id
    from public.get_entity_descendants(p_scope_entity_id, 10) descendant
  ) scoped_entities;

  select count(*)
  into v_active_entities
  from public.ecclesiastical_entities entity
  where entity.status = 'active'
    and entity.id = any(v_entity_ids);

  select count(*)
  into v_active_parishes
  from public.ecclesiastical_entities entity
  join public.entity_types entity_type on entity_type.id = entity.entity_type_id
  where entity.status = 'active'
    and entity.id = any(v_entity_ids)
    and entity_type.key in ('parish', 'quasi_parish');

  select count(*)
  into v_active_assignments
  from public.position_assignments assignment
  where assignment.record_status = 'active'
    and assignment.assignment_status = 'active'
    and assignment.is_current = true
    and assignment.ecclesiastical_entity_id = any(v_entity_ids);

  select count(*)
  into v_pending_reviews
  from public.change_requests request
  where request.status = 'pending_review'
    and (
      request.scope_entity_id = any(v_entity_ids)
      or request.diocese_id = any(v_entity_ids)
    );

  return jsonb_build_object(
    'territorial.active_entities', v_active_entities,
    'territorial.active_parishes', v_active_parishes,
    'administrative.active_assignments', v_active_assignments,
    'administrative.pending_reviews', v_pending_reviews
  );
end;
$function$;

revoke all on function public.get_admin_contextual_kpis(text, uuid) from public;
revoke all on function public.get_admin_contextual_kpis(text, uuid) from anon;
grant execute on function public.get_admin_contextual_kpis(text, uuid) to authenticated;

comment on function public.get_admin_contextual_kpis(text, uuid) is
  'Returns authorized administrative KPI values for an entity-based active scope after validating the authenticated user scope and expanding canonical territorial descendants.';
