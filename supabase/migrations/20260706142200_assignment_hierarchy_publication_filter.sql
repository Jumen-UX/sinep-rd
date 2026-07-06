-- Make hierarchical public assignment view inherit publication filters from public_position_assignments.
-- Applied to project hrvgpceqaxujlttpimdz on 2026-07-06.

create or replace view public.public_position_assignments_with_hierarchy
with (security_invoker = true)
as
select
  ppa.id,
  ppa.person_id,
  ppa.person_name,
  ppa.person_slug,
  ppa.person_type,
  ppa.office_configuration_id,
  ppa.position_title,
  ppa.office_configuration_key,
  ppa.base_role_name,
  ppa.scope_name,
  ppa.category_name,
  ppa.organization_chart_name,
  ppa.organization_chart_key,
  ppa.organization_unit_name,
  h.direct_entity_name,
  h.direct_entity_slug,
  h.direct_entity_type_name,
  h.parish_name,
  h.parish_slug,
  h.zone_name,
  h.zone_slug,
  h.vicariate_name,
  h.vicariate_slug,
  h.diocese_name,
  h.diocese_slug,
  h.hierarchy_path,
  ppa.pastoral_entity_name,
  ppa.pastoral_entity_slug,
  ppa.predecessor_person_id,
  ppa.predecessor_person_name,
  ppa.predecessor_person_slug,
  ppa.successor_person_id,
  ppa.successor_person_name,
  ppa.successor_person_slug,
  ppa.start_date,
  ppa.term_start_date,
  ppa.term_end_date,
  ppa.actual_end_date,
  ppa.is_current,
  ppa.assignment_status,
  ppa.selection_method,
  ppa.notes_public,
  ppa.verification_status,
  ppa.effective_date,
  ppa.public_from,
  ppa.public_until
from public.public_position_assignments ppa
left join public.position_assignments pa on pa.id = ppa.id
left join public.public_entity_hierarchy_paths h on h.direct_entity_id = pa.ecclesiastical_entity_id;
