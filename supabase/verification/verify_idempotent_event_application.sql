-- Verificación de S5-07: aplicación idempotente de eventos organizativos.
-- Este script es de solo lectura. No aplica eventos ni modifica datos.

with function_contract as (
  select
    p.oid::regprocedure::text as signature,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'internal'
    and p.proname = 'admin_apply_organization_unit_event'
),
contract_checks as (
  select
    signature,
    position('idempotent_replay' in definition) > 0 as has_idempotent_replay,
    position('event_action_dependency_missing' in definition) > 0 as validates_missing_dependencies,
    position('event_action_dependency_not_applied' in definition) > 0 as validates_dependency_order,
    position('order by sort_order, id' in definition) > 0 as has_deterministic_order,
    position('status = ''applied''' in definition) > 0 as recognizes_terminal_state,
    position('for update' in lower(definition)) > 0 as locks_rows
  from function_contract
),
readiness as (
  select
    count(*) filter (where ce.status = 'approved' and cet.applies_to = 'organization_unit') as approved_organizational_events,
    count(*) filter (
      where ce.status = 'approved'
        and cet.applies_to = 'organization_unit'
        and exists (
          select 1
          from canonical_event_actions cea
          where cea.event_id = ce.id
        )
        and not exists (
          select 1
          from canonical_event_actions cea
          where cea.event_id = ce.id
            and cea.status in ('planned', 'failed')
        )
    ) as ready_for_controlled_test
  from canonical_events ce
  join canonical_event_types cet on cet.id = ce.event_type_id
)
select
  cc.*,
  r.approved_organizational_events,
  r.ready_for_controlled_test,
  (
    cc.has_idempotent_replay
    and cc.validates_missing_dependencies
    and cc.validates_dependency_order
    and cc.has_deterministic_order
    and cc.recognizes_terminal_state
    and cc.locks_rows
  ) as contract_ready
from contract_checks cc
cross join readiness r;
