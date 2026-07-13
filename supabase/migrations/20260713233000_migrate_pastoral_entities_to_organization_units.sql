alter table public.organization_units
  add column if not exists pastoral_area_id uuid references public.pastoral_areas(id) on delete restrict,
  add column if not exists valid_from date,
  add column if not exists valid_to date,
  add column if not exists is_current boolean not null default true;

with chart as (
  select id from public.organization_charts where key = 'diocesan_pastoral' limit 1
)
insert into public.organization_units (
  id,
  organization_chart_id,
  parent_unit_id,
  ecclesiastical_entity_id,
  key,
  name,
  description,
  sort_order,
  visibility,
  status,
  pastoral_area_id,
  valid_from,
  valid_to,
  is_current,
  created_at,
  updated_at
)
select
  pe.id,
  chart.id,
  null,
  coalesce(pe.linked_ecclesiastical_entity_id, pe.diocese_id),
  pe.slug,
  pe.name,
  pe.description,
  row_number() over (partition by pe.diocese_id order by pe.name, pe.id)::integer,
  case when pe.visibility in ('public','internal','private') then pe.visibility else 'internal' end,
  case
    when pe.status = 'active' and pe.is_current then 'active'
    when pe.status in ('inactive','archived') or not pe.is_current then 'inactive'
    else 'draft'
  end,
  pe.pastoral_area_id,
  pe.start_date,
  pe.end_date,
  pe.is_current,
  pe.created_at,
  pe.updated_at
from public.pastoral_entities pe
cross join chart
on conflict (id) do update set
  organization_chart_id = excluded.organization_chart_id,
  ecclesiastical_entity_id = excluded.ecclesiastical_entity_id,
  key = excluded.key,
  name = excluded.name,
  description = excluded.description,
  visibility = excluded.visibility,
  status = excluded.status,
  pastoral_area_id = excluded.pastoral_area_id,
  valid_from = excluded.valid_from,
  valid_to = excluded.valid_to,
  is_current = excluded.is_current,
  updated_at = excluded.updated_at;

update public.organization_units ou
set parent_unit_id = pe.parent_pastoral_entity_id
from public.pastoral_entities pe
where ou.id = pe.id
  and pe.parent_pastoral_entity_id is not null
  and exists (
    select 1
    from public.organization_units parent
    where parent.id = pe.parent_pastoral_entity_id
  );

comment on column public.organization_units.pastoral_area_id is
  'Clasificación pastoral canónica de la unidad organizativa.';
comment on column public.organization_units.valid_from is
  'Fecha desde la cual la unidad organizativa tiene vigencia.';
comment on column public.organization_units.valid_to is
  'Fecha hasta la cual la unidad organizativa tuvo vigencia.';
comment on column public.organization_units.is_current is
  'Indica si la unidad organizativa pertenece a la estructura vigente.';
