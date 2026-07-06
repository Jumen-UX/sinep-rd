create or replace view public.admin_parish_responsibility_alerts
with (security_invoker = true)
as
with parish_entities as (
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
  where et.key in ('parish','quasi_parish')
    and ee.status = 'active'
), responsible_assignments as (
  select
    pa.ecclesiastical_entity_id,
    count(*) filter (
      where pa.person_id is not null
        and pa.assignment_status <> 'vacant'
    ) as responsible_count,
    string_agg(distinct p.display_name, ', ' order by p.display_name) filter (
      where pa.person_id is not null
        and pa.assignment_status <> 'vacant'
    ) as responsible_names,
    bool_or(pa.assignment_status = 'vacant') as has_registered_vacancy
  from public.position_assignments pa
  join public.office_configurations oc on oc.id = pa.office_configuration_id
  left join public.persons p on p.id = pa.person_id
  where oc.key in ('parroco_parroquial','administrador_parroquial')
    and pa.record_status = 'active'
    and pa.is_current = true
    and pa.assignment_status in ('active','term_expired_still_serving','renewed','vacant')
  group by pa.ecclesiastical_entity_id
)
select
  pe.id as parish_id,
  pe.name as parish_name,
  pe.slug as parish_slug,
  pe.entity_type_name,
  pe.entity_type_key,
  pe.municipality,
  pe.province,
  coalesce(ra.responsible_count, 0) as responsible_count,
  ra.responsible_names,
  coalesce(ra.has_registered_vacancy, false) as has_registered_vacancy,
  case
    when coalesce(ra.responsible_count, 0) = 0 and coalesce(ra.has_registered_vacancy, false) then 'vacante_registrada'
    when coalesce(ra.responsible_count, 0) = 0 then 'posible_vacancia'
    else 'con_responsable'
  end as alert_status,
  case
    when coalesce(ra.responsible_count, 0) = 0 and coalesce(ra.has_registered_vacancy, false) then 'Vacante registrada'
    when coalesce(ra.responsible_count, 0) = 0 then 'Posible vacancia'
    else 'Con responsable principal'
  end as alert_label
from parish_entities pe
left join responsible_assignments ra on ra.ecclesiastical_entity_id = pe.id;

grant select on public.admin_parish_responsibility_alerts to authenticated;
