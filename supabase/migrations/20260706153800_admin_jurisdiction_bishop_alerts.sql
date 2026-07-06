create or replace view public.admin_jurisdiction_bishop_alerts
with (security_invoker = true)
as
with jurisdictions as (
  select
    ee.id,
    ee.name,
    ee.slug,
    ee.municipality,
    ee.province,
    ee.status,
    et.name as entity_type_name,
    et.key as entity_type_key
  from public.ecclesiastical_entities ee
  join public.entity_types et on et.id = ee.entity_type_id
  where et.key in ('archdiocese','diocese','military_ordinariate')
    and ee.status = 'active'
), titular_assignments as (
  select
    pa.ecclesiastical_entity_id,
    count(*) filter (
      where pa.person_id is not null
        and pa.assignment_status <> 'vacant'
    ) as titular_count,
    string_agg(distinct p.display_name, ', ' order by p.display_name) filter (
      where pa.person_id is not null
        and pa.assignment_status <> 'vacant'
    ) as titular_names,
    bool_or(pa.assignment_status = 'vacant') as has_registered_vacancy
  from public.position_assignments pa
  join public.office_configurations oc on oc.id = pa.office_configuration_id
  left join public.persons p on p.id = pa.person_id
  where oc.key in ('obispo_diocesano')
    and pa.record_status = 'active'
    and pa.is_current = true
    and pa.assignment_status in ('active','term_expired_still_serving','renewed','vacant')
  group by pa.ecclesiastical_entity_id
)
select
  j.id as jurisdiction_id,
  j.name as jurisdiction_name,
  j.slug as jurisdiction_slug,
  j.entity_type_name,
  j.entity_type_key,
  j.municipality,
  j.province,
  coalesce(ta.titular_count, 0) as titular_count,
  ta.titular_names,
  coalesce(ta.has_registered_vacancy, false) as has_registered_vacancy,
  case
    when coalesce(ta.titular_count, 0) = 0 and coalesce(ta.has_registered_vacancy, false) then 'sede_vacante_registrada'
    when coalesce(ta.titular_count, 0) = 0 then 'posible_sede_vacante'
    else 'con_obispo_titular'
  end as alert_status,
  case
    when coalesce(ta.titular_count, 0) = 0 and coalesce(ta.has_registered_vacancy, false) then 'Sede vacante registrada'
    when coalesce(ta.titular_count, 0) = 0 then 'Posible sede vacante'
    else 'Con obispo titular'
  end as alert_label
from jurisdictions j
left join titular_assignments ta on ta.ecclesiastical_entity_id = j.id;

grant select on public.admin_jurisdiction_bishop_alerts to authenticated;
