drop view if exists public.public_pastoral_entities;

alter table public.pastoral_entities
  drop constraint if exists pastoral_entities_structure_level_id_fkey,
  drop constraint if exists pastoral_entities_structure_template_id_fkey;

alter table public.pastoral_entities
  drop column if exists structure_level_id,
  drop column if exists structure_template_id;

create or replace view public.public_organization_units
with (security_invoker = true)
as
select
  ou.id,
  ou.organization_chart_id,
  oc.key as organization_chart_key,
  oc.name as organization_chart_name,
  ou.parent_unit_id,
  parent.name as parent_unit_name,
  parent.key as parent_unit_key,
  ou.ecclesiastical_entity_id,
  ee.name as ecclesiastical_entity_name,
  ee.slug as ecclesiastical_entity_slug,
  ou.pastoral_area_id,
  pa.name as pastoral_area_name,
  pa.slug as pastoral_area_slug,
  ou.key,
  ou.name,
  ou.description,
  ou.valid_from,
  ou.valid_to,
  ou.is_current,
  ou.visibility,
  ou.status,
  ou.created_at,
  ou.updated_at
from public.organization_units ou
join public.organization_charts oc on oc.id = ou.organization_chart_id
left join public.organization_units parent on parent.id = ou.parent_unit_id
left join public.ecclesiastical_entities ee on ee.id = ou.ecclesiastical_entity_id
left join public.pastoral_areas pa on pa.id = ou.pastoral_area_id
where ou.status = 'active'
  and ou.visibility = 'public'
  and ou.is_current = true;

grant select on public.public_organization_units to anon, authenticated;

create or replace function app_private.review_permission_for_table(
  p_record_table text,
  p_action text
)
returns text
language sql
stable
security definer
set search_path = public, app_private, pg_temp
as $$
  select case
    when p_record_table in ('persons', 'clergy_profiles', 'religious_profiles', 'person_private_validation')
      then 'people.' || p_action
    when p_record_table in ('ecclesiastical_entities', 'entity_relationships', 'pastoral_areas', 'organization_units')
      then 'entities.' || p_action
    when p_record_table in ('position_assignments', 'appointments')
      then 'appointments.' || p_action
    when p_record_table in ('structure_templates', 'structure_levels', 'structure_nodes', 'structure_level_edges', 'structure_node_edges')
      then 'structures.manage'
    when p_record_table in ('commemorative_events', 'event_occurrences', 'event_reminders')
      then 'events.' || p_action
    when p_record_table = 'documents'
      then 'documents.' || p_action
    else null
  end;
$$;

revoke all on function app_private.review_permission_for_table(text, text) from public, anon, authenticated;
grant execute on function app_private.review_permission_for_table(text, text) to service_role;
