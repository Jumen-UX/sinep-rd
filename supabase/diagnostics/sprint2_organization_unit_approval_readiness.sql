-- Sprint 2 · Diagnóstico de preparación para aprobar unidades organizativas
-- Solo lectura. No modifica estados ni visibilidad.

-- 1. Resumen por organigrama activo.
select
  oc.id as organization_chart_id,
  oc.key as organization_chart_key,
  oc.name as organization_chart_name,
  count(ou.id) filter (where ou.status='draft' and ou.is_current=true) as draft_current,
  count(ou.id) filter (where ou.status='active' and ou.is_current=true) as active_current,
  count(ou.id) filter (where ou.visibility='public' and ou.is_current=true) as public_current,
  count(ou.id) filter (where ou.parent_unit_id is null and ou.is_current=true) as root_count,
  count(ou.id) filter (where ou.parent_unit_id is not null and ou.is_current=true) as child_count
from public.organization_charts oc
left join public.organization_units ou on ou.organization_chart_id=oc.id
where oc.status='active'
group by oc.id, oc.key, oc.name
order by oc.name;

-- 2. Preparación por entidad de alcance dentro de pastorales diocesanas.
-- Criterio propuesto: una unidad cabecera por entidad y las áreas pastorales debajo de ella.
select
  ee.id as ecclesiastical_entity_id,
  ee.name as ecclesiastical_entity_name,
  count(*) as draft_units,
  count(*) filter (where ou.parent_unit_id is null) as root_count,
  count(*) filter (where ou.parent_unit_id is not null) as child_count,
  count(*) filter (where ou.pastoral_area_id is null) as header_candidates,
  count(*) filter (where ou.pastoral_area_id is not null) as pastoral_area_units,
  case
    when count(*) filter (where ou.parent_unit_id is null)=1
      and count(*) filter (where ou.pastoral_area_id is null)=1
      and count(*) filter (where ou.parent_unit_id is not null)=count(*) filter (where ou.pastoral_area_id is not null)
    then 'ready_for_functional_review'
    else 'requires_hierarchy_normalization'
  end as readiness
from public.organization_units ou
join public.organization_charts oc on oc.id=ou.organization_chart_id and oc.key='diocesan_pastoral'
join public.ecclesiastical_entities ee on ee.id=ou.ecclesiastical_entity_id
where ou.status='draft' and ou.is_current=true
group by ee.id, ee.name
order by readiness, ee.name;

-- 3. Unidades que impedirían aprobación automática por falta de identidad o alcance.
select
  ou.id,
  ou.name,
  ou.slug,
  ou.organization_chart_id,
  ou.ecclesiastical_entity_id,
  ou.parent_unit_id,
  ou.pastoral_area_id,
  case
    when ou.organization_chart_id is null then 'missing_chart'
    when ou.ecclesiastical_entity_id is null then 'missing_scope_entity'
    when ou.name is null or btrim(ou.name)='' then 'missing_name'
    when ou.slug is null or btrim(ou.slug)='' then 'missing_slug'
    else 'ok'
  end as blocking_reason
from public.organization_units ou
where ou.status='draft' and ou.is_current=true
  and (
    ou.organization_chart_id is null
    or ou.ecclesiastical_entity_id is null
    or ou.name is null or btrim(ou.name)=''
    or ou.slug is null or btrim(ou.slug)=''
  )
order by blocking_reason, ou.name;

-- 4. Resumen compacto para gates operativos.
with readiness as (
  select
    ee.id,
    count(*) filter (where ou.parent_unit_id is null) as root_count,
    count(*) filter (where ou.parent_unit_id is not null) as child_count,
    count(*) filter (where ou.pastoral_area_id is null) as header_candidates,
    count(*) filter (where ou.pastoral_area_id is not null) as pastoral_area_units
  from public.organization_units ou
  join public.organization_charts oc on oc.id=ou.organization_chart_id and oc.key='diocesan_pastoral'
  join public.ecclesiastical_entities ee on ee.id=ou.ecclesiastical_entity_id
  where ou.status='draft' and ou.is_current=true
  group by ee.id
)
select 'scope_entities_ready_for_review' as check_key,
       count(*) filter (
         where root_count=1
           and header_candidates=1
           and child_count=pastoral_area_units
       )::bigint as issue_count
from readiness
union all
select 'scope_entities_requiring_hierarchy_normalization',
       count(*) filter (
         where not (
           root_count=1
           and header_candidates=1
           and child_count=pastoral_area_units
         )
       )::bigint
from readiness;
