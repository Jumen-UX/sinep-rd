-- Sprint 2 · Paridad del ciclo de vida de unidades organizativas
-- Solo lectura. Complementa sprint2_structural_parity.sql para no ocultar unidades current en estado draft.

select status, is_current, count(*)::bigint as records
from public.organization_units
group by status, is_current
order by status, is_current;

with checks as (
  select 'current_units_total' as check_key, count(*)::bigint as issue_count
  from public.organization_units ou
  where ou.is_current = true

  union all
  select 'draft_current_units', count(*)::bigint
  from public.organization_units ou
  where ou.is_current = true and ou.status = 'draft'

  union all
  select 'current_units_without_chart', count(*)::bigint
  from public.organization_units ou
  left join public.organization_charts oc on oc.id = ou.organization_chart_id
  where ou.is_current = true and oc.id is null

  union all
  select 'current_units_with_inactive_chart', count(*)::bigint
  from public.organization_units ou
  join public.organization_charts oc on oc.id = ou.organization_chart_id
  where ou.is_current = true and oc.status <> 'active'

  union all
  select 'current_cross_chart_parent_units', count(*)::bigint
  from public.organization_units child
  join public.organization_units parent on parent.id = child.parent_unit_id
  where child.is_current = true
    and parent.is_current = true
    and child.organization_chart_id <> parent.organization_chart_id

  union all
  select 'current_units_without_scope_entity', count(*)::bigint
  from public.organization_units ou
  where ou.is_current = true and ou.ecclesiastical_entity_id is null
)
select * from checks order by check_key;
