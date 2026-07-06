create or replace view public.admin_entity_hierarchy_selector
with (security_invoker = true)
as
with recursive entity_ancestors as (
  select
    ee.id as direct_entity_id,
    ee.id as entity_id,
    et.key as entity_type_key,
    ee.name as entity_name,
    ee.slug as entity_slug,
    0 as depth
  from public.ecclesiastical_entities ee
  join public.entity_types et on et.id = ee.entity_type_id
  where ee.status = 'active'

  union all

  select
    ea.direct_entity_id,
    parent.id as entity_id,
    parent_type.key as entity_type_key,
    parent.name as entity_name,
    parent.slug as entity_slug,
    ea.depth + 1 as depth
  from entity_ancestors ea
  join public.entity_relationships er
    on er.child_entity_id = ea.entity_id
   and er.is_current = true
   and er.status = 'active'
  join public.ecclesiastical_entities parent on parent.id = er.parent_entity_id
  join public.entity_types parent_type on parent_type.id = parent.entity_type_id
  where ea.depth < 8
), direct_entities as (
  select
    ee.id,
    ee.name,
    ee.slug,
    et.key as entity_type_key,
    et.name as entity_type_name
  from public.ecclesiastical_entities ee
  join public.entity_types et on et.id = ee.entity_type_id
  where ee.status = 'active'
)
select
  de.id as direct_entity_id,
  de.name as direct_entity_name,
  de.slug as direct_entity_slug,
  de.entity_type_key as direct_entity_type_key,
  de.entity_type_name as direct_entity_type_name,
  coalesce(
    max(ea.entity_id::text) filter (where ea.entity_type_key in ('archdiocese','diocese','military_ordinariate')),
    max(case when de.entity_type_key in ('archdiocese','diocese','military_ordinariate') then de.id::text end)
  )::uuid as jurisdiction_id,
  coalesce(
    max(ea.entity_name) filter (where ea.entity_type_key in ('archdiocese','diocese','military_ordinariate')),
    max(case when de.entity_type_key in ('archdiocese','diocese','military_ordinariate') then de.name end)
  ) as jurisdiction_name,
  coalesce(
    max(ea.entity_slug) filter (where ea.entity_type_key in ('archdiocese','diocese','military_ordinariate')),
    max(case when de.entity_type_key in ('archdiocese','diocese','military_ordinariate') then de.slug end)
  ) as jurisdiction_slug,
  coalesce(
    max(ea.entity_id::text) filter (where ea.entity_type_key = 'vicariate'),
    max(case when de.entity_type_key = 'vicariate' then de.id::text end)
  )::uuid as vicariate_id,
  coalesce(
    max(ea.entity_name) filter (where ea.entity_type_key = 'vicariate'),
    max(case when de.entity_type_key = 'vicariate' then de.name end)
  ) as vicariate_name,
  coalesce(
    max(ea.entity_slug) filter (where ea.entity_type_key = 'vicariate'),
    max(case when de.entity_type_key = 'vicariate' then de.slug end)
  ) as vicariate_slug,
  coalesce(
    max(ea.entity_id::text) filter (where ea.entity_type_key in ('pastoral_zone','deanery','pastoral_region')),
    max(case when de.entity_type_key in ('pastoral_zone','deanery','pastoral_region') then de.id::text end)
  )::uuid as zone_id,
  coalesce(
    max(ea.entity_name) filter (where ea.entity_type_key in ('pastoral_zone','deanery','pastoral_region')),
    max(case when de.entity_type_key in ('pastoral_zone','deanery','pastoral_region') then de.name end)
  ) as zone_name,
  coalesce(
    max(ea.entity_slug) filter (where ea.entity_type_key in ('pastoral_zone','deanery','pastoral_region')),
    max(case when de.entity_type_key in ('pastoral_zone','deanery','pastoral_region') then de.slug end)
  ) as zone_slug,
  max(case when de.entity_type_key in ('parish','quasi_parish') then de.id::text end)::uuid as parish_id,
  max(case when de.entity_type_key in ('parish','quasi_parish') then de.name end) as parish_name,
  max(case when de.entity_type_key in ('parish','quasi_parish') then de.slug end) as parish_slug,
  concat_ws(' > ',
    coalesce(
      max(ea.entity_name) filter (where ea.entity_type_key in ('archdiocese','diocese','military_ordinariate')),
      max(case when de.entity_type_key in ('archdiocese','diocese','military_ordinariate') then de.name end)
    ),
    coalesce(max(ea.entity_name) filter (where ea.entity_type_key = 'vicariate'), max(case when de.entity_type_key = 'vicariate' then de.name end)),
    coalesce(max(ea.entity_name) filter (where ea.entity_type_key in ('pastoral_zone','deanery','pastoral_region')), max(case when de.entity_type_key in ('pastoral_zone','deanery','pastoral_region') then de.name end)),
    max(case when de.entity_type_key in ('parish','quasi_parish') then de.name end)
  ) as hierarchy_path
from direct_entities de
left join entity_ancestors ea on ea.direct_entity_id = de.id
where de.entity_type_key in ('archdiocese','diocese','military_ordinariate','vicariate','pastoral_zone','deanery','pastoral_region','parish','quasi_parish')
group by de.id, de.name, de.slug, de.entity_type_key, de.entity_type_name;

grant select on public.admin_entity_hierarchy_selector to authenticated;
