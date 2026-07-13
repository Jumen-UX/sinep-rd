update public.office_configurations
set organization_chart_id=(select id from public.organization_charts where key='parish_ministry'),
    updated_at=now()
where key='diacono_adscrito_parroquial'
  and organization_chart_id is distinct from (select id from public.organization_charts where key='parish_ministry');

with rules(entity_type_key,office_key,is_default) as (
  values
    ('archdiocese','obispo_diocesano',true),
    ('archdiocese','obispo_auxiliar',false),
    ('archdiocese','vicario_general',false),
    ('diocese','obispo_diocesano',true),
    ('diocese','obispo_auxiliar',false),
    ('diocese','vicario_general',false),
    ('vicariate','vicario_episcopal',true),
    ('pastoral_zone','archipreste_zona_pastoral',true),
    ('parish','parroco_parroquial',true),
    ('parish','administrador_parroquial',false),
    ('parish','vicario_parroquial',false),
    ('parish','diacono_adscrito_parroquial',false)
)
insert into public.structure_level_office_configurations(
  id,level_id,office_configuration_id,is_default,sort_order,status,metadata
)
select
  gen_random_uuid(),sl.id,oc.id,r.is_default,coalesce(oc.sort_order,0),'active',
  jsonb_build_object('source','canonical_level_mapping','entity_type_key',r.entity_type_key)
from rules r
join public.entity_types et on et.key=r.entity_type_key
join public.structure_levels sl on sl.linked_entity_type_id=et.id
join public.office_configurations oc on oc.key=r.office_key and oc.status='active'
on conflict(level_id,office_configuration_id) do update
set is_default=excluded.is_default,
    sort_order=excluded.sort_order,
    status='active',
    metadata=excluded.metadata,
    updated_at=now();
