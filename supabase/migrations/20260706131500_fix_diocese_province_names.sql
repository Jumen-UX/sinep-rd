-- Prevent national jurisdictions, such as the Military Ordinariate,
-- from being counted as ecclesiastical provinces in public dashboards.

create or replace view public_dioceses as
select
  ee.id,
  et.key as entity_type_key,
  et.name as entity_type_name,
  ee.name,
  ee.official_name,
  ee.slug,
  ee.description,
  ee.latin_name,
  ee.cathedral_name,
  ee.current_ordinary_name,
  ee.current_ordinary_title,
  ee.territory_summary,
  ee.area_km2,
  ee.statistics_year,
  ee.population_total,
  ee.catholics_total,
  ee.catholics_percent,
  ee.parishes_count,
  ee.source_name,
  ee.source_url,
  ee.source_checked_at,
  ee.country,
  ee.province,
  ee.municipality,
  ee.address,
  ee.email,
  ee.phone,
  ee.website,
  ee.facebook_url,
  ee.instagram_url,
  ee.youtube_url,
  ee.erected_at,
  case when parent_type.key = 'ecclesiastical_province' then parent.name else null end as ecclesiastical_province_name,
  case when parent_type.key = 'ecclesiastical_province' then parent.slug else null end as ecclesiastical_province_slug,
  er.relationship_type,
  ee.created_at,
  ee.updated_at
from ecclesiastical_entities ee
join entity_types et on et.id = ee.entity_type_id
left join entity_relationships er
  on er.child_entity_id = ee.id
  and er.is_current = true
  and er.status = 'active'
left join ecclesiastical_entities parent on parent.id = er.parent_entity_id
left join entity_types parent_type on parent_type.id = parent.entity_type_id
where et.key in ('archdiocese', 'diocese', 'military_ordinariate')
  and ee.visibility = 'public'
  and ee.status = 'active'
  and (
    parent.id is null
    or parent_type.key in ('ecclesiastical_province', 'country')
  );

alter view public_dioceses set (security_invoker = true);
