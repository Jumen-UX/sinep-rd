create or replace view public.admin_structure_responsibility_alerts as
with responsible_level_offices as (
  select
    sloc.level_id,
    sloc.office_configuration_id,
    sloc.is_default,
    sloc.sort_order
  from public.structure_level_office_configurations sloc
  where sloc.status = 'active'
    and sloc.is_default = true
), monitored_nodes as (
  select
    sn.id as node_id,
    sn.template_id,
    st.name as template_name,
    st.kind_key,
    sn.level_id,
    sl.name as level_name,
    sl.level_key,
    sl.level_order,
    sn.diocese_id,
    d.name as diocese_name,
    sn.parent_node_id,
    sn.name as node_name,
    sn.slug as node_slug,
    sn.linked_ecclesiastical_entity_id,
    ee.name as entity_name,
    ee.slug as entity_slug,
    et.name as entity_type_name,
    et.key as entity_type_key,
    ee.municipality,
    ee.province,
    rlo.office_configuration_id,
    oc.display_name as responsible_office_name,
    oc.key as responsible_office_key
  from public.structure_nodes sn
  join public.structure_templates st on st.id = sn.template_id
  join public.structure_levels sl on sl.id = sn.level_id
  join responsible_level_offices rlo on rlo.level_id = sn.level_id
  join public.office_configurations oc on oc.id = rlo.office_configuration_id
  left join public.ecclesiastical_entities ee on ee.id = sn.linked_ecclesiastical_entity_id
  left join public.entity_types et on et.id = ee.entity_type_id
  left join public.ecclesiastical_entities d on d.id = sn.diocese_id
  where sn.status = 'active'
    and sn.is_current = true
    and st.status = 'active'
    and st.is_active = true
    and sn.linked_ecclesiastical_entity_id is not null
), responsible_assignments as (
  select
    mn.node_id,
    count(*) filter (
      where pa.person_id is not null
        and pa.assignment_status <> 'vacant'
    ) as responsible_count,
    string_agg(distinct p.display_name, ', ' order by p.display_name) filter (
      where pa.person_id is not null
        and pa.assignment_status <> 'vacant'
    ) as responsible_names,
    bool_or(pa.assignment_status = 'vacant') as has_registered_vacancy
  from monitored_nodes mn
  left join public.position_assignments pa
    on pa.ecclesiastical_entity_id = mn.linked_ecclesiastical_entity_id
   and pa.office_configuration_id = mn.office_configuration_id
   and pa.record_status = 'active'
   and pa.is_current = true
   and pa.assignment_status = any(array['active', 'term_expired_still_serving', 'renewed', 'vacant'])
  left join public.persons p on p.id = pa.person_id
  group by mn.node_id
)
select
  mn.node_id,
  mn.template_id,
  mn.template_name,
  mn.kind_key,
  mn.level_id,
  mn.level_name,
  mn.level_key,
  mn.level_order,
  mn.diocese_id,
  mn.diocese_name,
  mn.linked_ecclesiastical_entity_id as entity_id,
  coalesce(mn.entity_name, mn.node_name) as entity_name,
  mn.entity_slug,
  mn.entity_type_name,
  mn.entity_type_key,
  mn.node_name,
  mn.node_slug,
  mn.municipality,
  mn.province,
  mn.responsible_office_name,
  mn.responsible_office_key,
  coalesce(ra.responsible_count, 0::bigint) as responsible_count,
  ra.responsible_names,
  coalesce(ra.has_registered_vacancy, false) as has_registered_vacancy,
  case
    when coalesce(ra.responsible_count, 0::bigint) = 0 and coalesce(ra.has_registered_vacancy, false) then 'vacante_registrada'::text
    when coalesce(ra.responsible_count, 0::bigint) = 0 then 'posible_vacancia'::text
    else 'con_responsable'::text
  end as alert_status,
  case
    when coalesce(ra.responsible_count, 0::bigint) = 0 and coalesce(ra.has_registered_vacancy, false) then 'Vacante registrada'::text
    when coalesce(ra.responsible_count, 0::bigint) = 0 then 'Posible vacancia'::text
    else 'Con responsable principal'::text
  end as alert_label
from monitored_nodes mn
left join responsible_assignments ra on ra.node_id = mn.node_id;

grant select on public.admin_structure_responsibility_alerts to authenticated;
