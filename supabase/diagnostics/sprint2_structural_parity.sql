-- Sprint 2 · Consultas reproducibles de paridad estructural
-- Solo lectura. Ejecutar en Supabase SQL Editor o psql con un rol autorizado.

-- 1. Resumen general de modelos canónicos activos.
select 'ecclesiastical_entities' as model, count(*)::bigint as active_records
from public.ecclesiastical_entities
where status = 'active'
union all
select 'structure_templates', count(*)::bigint
from public.structure_templates
where status = 'active'
union all
select 'structure_levels', count(*)::bigint
from public.structure_levels
union all
select 'structure_nodes', count(*)::bigint
from public.structure_nodes
where status = 'active' and is_current = true
union all
select 'organization_charts', count(*)::bigint
from public.organization_charts
where status = 'active'
union all
select 'organization_units', count(*)::bigint
from public.organization_units
where status = 'active' and is_current = true;

-- 2. Catálogos estructurales sin raíz vigente.
select
  st.id as template_id,
  st.name as template_name,
  st.kind_key,
  st.diocese_id
from public.structure_templates st
where st.status = 'active'
  and not exists (
    select 1
    from public.structure_nodes sn
    where sn.template_id = st.id
      and sn.status = 'active'
      and sn.is_current = true
      and not exists (
        select 1
        from public.structure_node_edges sne
        where sne.child_node_id = sn.id
          and sne.is_current = true
      )
  )
order by st.name;

-- 3. Nodos vigentes con más de un padre vigente.
select
  sne.child_node_id,
  count(*)::bigint as current_parent_count
from public.structure_node_edges sne
where sne.is_current = true
group by sne.child_node_id
having count(*) > 1
order by current_parent_count desc, sne.child_node_id;

-- 4. Nodos vigentes cuyo padre vigente pertenece a otro catálogo.
select
  child.id as child_node_id,
  child.template_id as child_template_id,
  parent.id as parent_node_id,
  parent.template_id as parent_template_id
from public.structure_node_edges edge
join public.structure_nodes child on child.id = edge.child_node_id
join public.structure_nodes parent on parent.id = edge.parent_node_id
where edge.is_current = true
  and child.template_id <> parent.template_id;

-- 5. Nodos territoriales vigentes sin entidad institucional enlazada.
-- Se consideran candidatos a inconsistencia únicamente los niveles vinculados a un tipo de entidad.
select
  sn.id as node_id,
  sn.name as node_name,
  sl.level_key,
  st.name as template_name
from public.structure_nodes sn
join public.structure_levels sl on sl.id = sn.level_id
join public.structure_templates st on st.id = sn.template_id
where sn.status = 'active'
  and sn.is_current = true
  and sl.linked_entity_type_id is not null
  and sn.linked_ecclesiastical_entity_id is null
order by st.name, sl.level_order, sn.name;

-- 6. Entidades institucionales activas vinculadas a más de un nodo vigente del mismo catálogo.
select
  sn.linked_ecclesiastical_entity_id as entity_id,
  sn.template_id,
  count(*)::bigint as current_node_count
from public.structure_nodes sn
where sn.status = 'active'
  and sn.is_current = true
  and sn.linked_ecclesiastical_entity_id is not null
group by sn.linked_ecclesiastical_entity_id, sn.template_id
having count(*) > 1
order by current_node_count desc, entity_id;

-- 7. Entidades activas cuyo tipo exige presencia territorial pero no tienen nodo vigente.
select
  ee.id as entity_id,
  ee.name as entity_name,
  et.key as entity_type_key
from public.ecclesiastical_entities ee
join public.entity_types et on et.id = ee.entity_type_id
where ee.status = 'active'
  and exists (
    select 1
    from public.structure_levels sl
    join public.structure_templates st on st.id = sl.template_id
    where sl.linked_entity_type_id = ee.entity_type_id
      and st.status = 'active'
      and st.diocese_id = coalesce(ee.diocese_id, ee.id)
  )
  and not exists (
    select 1
    from public.structure_nodes sn
    where sn.linked_ecclesiastical_entity_id = ee.id
      and sn.status = 'active'
      and sn.is_current = true
  )
order by et.key, ee.name;

-- 8. Unidades organizativas activas sin organigrama válido.
select
  ou.id as organization_unit_id,
  ou.name,
  ou.organization_chart_id
from public.organization_units ou
left join public.organization_charts oc on oc.id = ou.organization_chart_id
where ou.status = 'active'
  and ou.is_current = true
  and (oc.id is null or oc.status <> 'active')
order by ou.name;

-- 9. Unidades organizativas con padre vigente de otro organigrama.
select
  child.id as child_unit_id,
  child.organization_chart_id as child_chart_id,
  parent.id as parent_unit_id,
  parent.organization_chart_id as parent_chart_id
from public.organization_units child
join public.organization_units parent on parent.id = child.parent_unit_id
where child.status = 'active'
  and child.is_current = true
  and parent.status = 'active'
  and parent.is_current = true
  and child.organization_chart_id <> parent.organization_chart_id;

-- 10. Unidades activas sin entidad territorial de alcance.
-- Puede ser válido para organigramas nacionales; por eso se clasifica para revisión, no como fallo automático.
select
  ou.id as organization_unit_id,
  ou.name,
  oc.key as organization_chart_key,
  ou.parent_unit_id
from public.organization_units ou
join public.organization_charts oc on oc.id = ou.organization_chart_id
where ou.status = 'active'
  and ou.is_current = true
  and ou.ecclesiastical_entity_id is null
order by oc.key, ou.name;

-- 11. Nombramientos organizativos cuyo organigrama no coincide con el cargo.
select
  pa.id as assignment_id,
  pa.organization_chart_id as assignment_chart_id,
  oc.organization_chart_id as office_chart_id,
  pa.organization_unit_id
from public.position_assignments pa
join public.office_configurations oc on oc.id = pa.office_configuration_id
where pa.record_status = 'active'
  and pa.is_current = true
  and pa.organization_chart_id is distinct from oc.organization_chart_id;

-- 12. Nombramientos con unidad de otro organigrama.
select
  pa.id as assignment_id,
  pa.organization_chart_id,
  ou.organization_chart_id as unit_chart_id,
  pa.organization_unit_id
from public.position_assignments pa
join public.organization_units ou on ou.id = pa.organization_unit_id
where pa.record_status = 'active'
  and pa.is_current = true
  and pa.organization_chart_id is distinct from ou.organization_chart_id;

-- 13. Resumen compacto de discrepancias bloqueantes.
with checks as (
  select 'templates_without_root' as check_key, count(*)::bigint as issue_count
  from public.structure_templates st
  where st.status = 'active'
    and not exists (
      select 1
      from public.structure_nodes sn
      where sn.template_id = st.id
        and sn.status = 'active'
        and sn.is_current = true
        and not exists (
          select 1 from public.structure_node_edges sne
          where sne.child_node_id = sn.id and sne.is_current = true
        )
    )
  union all
  select 'nodes_with_multiple_current_parents', count(*)::bigint
  from (
    select sne.child_node_id
    from public.structure_node_edges sne
    where sne.is_current = true
    group by sne.child_node_id
    having count(*) > 1
  ) q
  union all
  select 'cross_template_current_edges', count(*)::bigint
  from public.structure_node_edges edge
  join public.structure_nodes child on child.id = edge.child_node_id
  join public.structure_nodes parent on parent.id = edge.parent_node_id
  where edge.is_current = true and child.template_id <> parent.template_id
  union all
  select 'organization_units_without_active_chart', count(*)::bigint
  from public.organization_units ou
  left join public.organization_charts oc on oc.id = ou.organization_chart_id
  where ou.status = 'active' and ou.is_current = true
    and (oc.id is null or oc.status <> 'active')
  union all
  select 'cross_chart_parent_units', count(*)::bigint
  from public.organization_units child
  join public.organization_units parent on parent.id = child.parent_unit_id
  where child.status = 'active' and child.is_current = true
    and parent.status = 'active' and parent.is_current = true
    and child.organization_chart_id <> parent.organization_chart_id
)
select * from checks order by check_key;
