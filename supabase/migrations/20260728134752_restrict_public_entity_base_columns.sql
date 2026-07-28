begin;

revoke select on table public.ecclesiastical_entities from anon;
grant select (
  id,
  entity_type_id,
  name,
  official_name,
  slug,
  description,
  country,
  country_iso2,
  province,
  municipality,
  sector,
  address,
  latitude,
  longitude,
  email,
  phone,
  website,
  facebook_url,
  instagram_url,
  youtube_url,
  status,
  visibility,
  erected_at,
  suppressed_at,
  created_at,
  updated_at,
  latin_name,
  cathedral_name,
  current_ordinary_name,
  current_ordinary_title,
  territory_summary,
  area_km2,
  statistics_year,
  population_total,
  catholics_total,
  catholics_percent,
  parishes_count,
  source_name,
  source_url,
  source_checked_at
) on table public.ecclesiastical_entities to anon;

revoke select on table public.entity_relationships from anon;
grant select (
  id,
  parent_entity_id,
  child_entity_id,
  relationship_type,
  start_date,
  end_date,
  is_current,
  status,
  created_at
) on table public.entity_relationships to anon;

comment on column public.entity_relationships.notes is
  'Internal editorial metadata. Not granted to anon; public clients use sanitized relationship views.';

comment on column public.entity_relationships.document_id is
  'Internal provenance reference. Not granted to anon.';

comment on column public.entity_relationships.approved_change_request_id is
  'Internal workflow reference. Not granted to anon.';

commit;
