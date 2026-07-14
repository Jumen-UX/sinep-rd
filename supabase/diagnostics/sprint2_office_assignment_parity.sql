-- Sprint 2 / S2-05 — paridad de cargos, organigramas y alcance.
-- Solo lectura.

select
  count(*) as active_level_office_relations,
  count(*) filter (where m.is_default) as default_relations,
  count(*) filter (where oc.id is null) as missing_office_references,
  count(*) filter (where oc.status <> 'active') as inactive_office_references
from public.structure_level_office_configurations m
left join public.office_configurations oc on oc.id = m.office_configuration_id
where m.status = 'active';

select
  sl.level_key,
  count(distinct m.office_configuration_id) as configured_offices,
  count(distinct oc.organization_chart_id) as organization_chart_families
from public.structure_levels sl
left join public.structure_level_office_configurations m
  on m.level_id = sl.id
 and m.status = 'active'
left join public.office_configurations oc
  on oc.id = m.office_configuration_id
 and oc.status = 'active'
group by sl.level_key
order by sl.level_key;

with current_assignments as (
  select pa.*
  from public.position_assignments pa
  where pa.is_current = true
    and pa.record_status = 'active'
)
select
  count(*) as current_assignments,
  count(*) filter (where pa.office_configuration_id is null) as without_office,
  count(*) filter (where pa.organization_chart_id is null) as without_chart,
  count(*) filter (
    where pa.organization_unit_id is null
      and pa.ecclesiastical_entity_id is null
  ) as without_scope,
  count(*) filter (
    where oc.organization_chart_id is not null
      and pa.organization_chart_id is distinct from oc.organization_chart_id
  ) as office_chart_mismatches,
  count(*) filter (
    where pa.organization_unit_id is not null
      and ou.organization_chart_id is distinct from pa.organization_chart_id
  ) as unit_chart_mismatches
from current_assignments pa
left join public.office_configurations oc on oc.id = pa.office_configuration_id
left join public.organization_units ou on ou.id = pa.organization_unit_id;
