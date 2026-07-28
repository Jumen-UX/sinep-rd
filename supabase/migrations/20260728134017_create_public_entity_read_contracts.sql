begin;

create or replace view public.public_entity_directory_details
with (security_invoker = true)
as
select
  entity_row.id,
  entity_row.entity_type_id,
  entity_row.name,
  entity_row.official_name,
  entity_row.slug,
  entity_row.description,
  entity_row.latin_name,
  entity_row.cathedral_name,
  entity_row.current_ordinary_name,
  entity_row.current_ordinary_title,
  entity_row.territory_summary,
  entity_row.area_km2,
  entity_row.statistics_year,
  entity_row.population_total,
  entity_row.catholics_total,
  entity_row.catholics_percent,
  entity_row.parishes_count,
  entity_row.source_name,
  entity_row.source_url,
  entity_row.source_checked_at,
  entity_row.country,
  entity_row.country_iso2,
  entity_row.province,
  entity_row.municipality,
  entity_row.sector,
  entity_row.address,
  entity_row.latitude,
  entity_row.longitude,
  entity_row.email,
  entity_row.phone,
  entity_row.website,
  entity_row.facebook_url,
  entity_row.instagram_url,
  entity_row.youtube_url,
  entity_row.status,
  entity_row.visibility,
  entity_row.erected_at,
  entity_row.suppressed_at,
  entity_row.created_at,
  entity_row.updated_at
from public.ecclesiastical_entities entity_row
where entity_row.status = 'active'
  and entity_row.visibility = 'public';

create or replace view public.public_entity_relationships
with (security_invoker = true)
as
select
  relationship_row.id,
  relationship_row.parent_entity_id,
  relationship_row.child_entity_id,
  relationship_row.relationship_type,
  relationship_row.start_date,
  relationship_row.end_date,
  relationship_row.is_current,
  relationship_row.status,
  relationship_row.created_at
from public.entity_relationships relationship_row
join public.ecclesiastical_entities parent_row
  on parent_row.id = relationship_row.parent_entity_id
join public.ecclesiastical_entities child_row
  on child_row.id = relationship_row.child_entity_id
where relationship_row.status = 'active'
  and parent_row.status = 'active'
  and parent_row.visibility = 'public'
  and child_row.status = 'active'
  and child_row.visibility = 'public';

revoke all on table public.public_entity_directory_details from public, anon, authenticated;
revoke all on table public.public_entity_relationships from public, anon, authenticated;

grant select on table public.public_entity_directory_details to anon, authenticated;
grant select on table public.public_entity_relationships to anon, authenticated;

comment on view public.public_entity_directory_details is
  'Sanitized public entity-detail contract. Excludes creator and internal workflow metadata.';

comment on view public.public_entity_relationships is
  'Sanitized public relationship contract. Excludes notes, documents, approval references and actor metadata.';

commit;
