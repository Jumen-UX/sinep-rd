-- Keep public organization-unit projections limited to currently effective records.
-- Approval and publication remain separate; this view only exposes units that are
-- active, public, current and effective on the query date.

drop view if exists public.public_organization_units;

create view public.public_organization_units
with (security_invoker = true)
as
select
  ou.id,
  ou.organization_chart_id,
  oc.key as organization_chart_key,
  oc.name as organization_chart_name,
  oc.sort_order as organization_chart_sort_order,
  ou.parent_unit_id,
  parent.name as parent_unit_name,
  parent.slug as parent_unit_slug,
  ou.ecclesiastical_entity_id,
  ee.name as ecclesiastical_entity_name,
  ee.slug as ecclesiastical_entity_slug,
  ou.pastoral_area_id,
  pa.name as pastoral_area_name,
  pa.slug as pastoral_area_slug,
  ou.key,
  ou.slug,
  ou.name,
  ou.description,
  ou.sort_order,
  ou.valid_from,
  ou.valid_to,
  ou.is_current,
  ou.visibility,
  ou.status,
  ou.created_at,
  ou.updated_at
from public.organization_units ou
join public.organization_charts oc on oc.id = ou.organization_chart_id
left join public.organization_units parent on parent.id = ou.parent_unit_id
left join public.ecclesiastical_entities ee on ee.id = ou.ecclesiastical_entity_id
left join public.pastoral_areas pa on pa.id = ou.pastoral_area_id
where ou.status = 'active'
  and ou.visibility = 'public'
  and ou.is_current = true
  and (ou.valid_from is null or ou.valid_from <= current_date)
  and (ou.valid_to is null or ou.valid_to >= current_date)
  and oc.status = 'active'
  and oc.visibility = 'public';

grant select on public.public_organization_units to anon, authenticated;
