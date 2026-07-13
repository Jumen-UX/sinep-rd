drop view if exists public.public_position_assignments_with_hierarchy;
drop view if exists public.public_position_assignments;
drop view if exists public.public_current_appointments;
drop view if exists public.public_person_movements;
drop view if exists public.public_calendar_events;
drop view if exists public.admin_pending_change_requests;
drop view if exists public.admin_dashboard_summary;

create view public.admin_dashboard_summary
with (security_invoker = true)
as
select
  (select count(*) from public.ecclesiastical_entities where status = 'active') as active_entities,
  (select count(*) from public.ecclesiastical_entities ee join public.entity_types et on et.id=ee.entity_type_id where et.key in ('archdiocese','diocese') and ee.status='active') as active_dioceses,
  (select count(*) from public.ecclesiastical_entities ee join public.entity_types et on et.id=ee.entity_type_id where et.key in ('parish','quasi_parish') and ee.status='active') as active_parishes,
  (select count(*) from public.persons where status='active') as active_people,
  (select count(*) from public.persons where person_type='priest' and status='active') as active_priests,
  (select count(*) from public.persons where person_type='deacon' and status='active') as active_deacons,
  (select count(*) from public.persons where person_type='bishop' and status in ('active','emeritus')) as bishops_and_emeriti,
  (select count(*) from public.pastoral_areas where status='active') as active_pastoral_areas,
  (select count(*) from public.organization_units where status='active') as active_organization_units,
  (select count(*) from public.change_requests where status='pending_review') as pending_change_requests,
  (select count(*) from public.documents where status='under_review') as pending_documents;

grant select on public.admin_dashboard_summary to authenticated;

create view public.admin_pending_change_requests
with (security_invoker = true)
as
select
  cr.id,
  cr.target_table,
  cr.target_id,
  cr.action_type,
  cr.title,
  cr.description,
  cr.status,
  cr.priority,
  cr.scope_type,
  cr.scope_entity_id,
  scope_entity.name as scope_entity_name,
  cr.diocese_id,
  diocese.name as diocese_name,
  cr.pastoral_area_id,
  pastoral_area.name as pastoral_area_name,
  cr.organization_unit_id,
  organization_unit.name as organization_unit_name,
  cr.current_step,
  cr.effective_date,
  cr.created_by,
  creator.full_name as created_by_name,
  creator.email as created_by_email,
  cr.submitted_by,
  submitter.full_name as submitted_by_name,
  submitter.email as submitted_by_email,
  cr.submitted_at,
  cr.reviewed_by,
  cr.reviewed_at,
  cr.approved_by,
  cr.approved_at,
  cr.published_by,
  cr.published_at,
  cr.rejection_reason,
  cr.correction_notes,
  cr.created_at,
  cr.updated_at
from public.change_requests cr
left join public.ecclesiastical_entities scope_entity on scope_entity.id=cr.scope_entity_id
left join public.ecclesiastical_entities diocese on diocese.id=cr.diocese_id
left join public.pastoral_areas pastoral_area on pastoral_area.id=cr.pastoral_area_id
left join public.organization_units organization_unit on organization_unit.id=cr.organization_unit_id
left join public.profiles creator on creator.id=cr.created_by
left join public.profiles submitter on submitter.id=cr.submitted_by
where cr.status in ('draft','pending_review','needs_changes','approved');

grant select on public.admin_pending_change_requests to authenticated;

create view public.public_calendar_events
with (security_invoker = true)
as
select
  eo.id,
  et.name as event_type_name,
  et.key as event_type_key,
  eo.title,
  eo.occurrence_date,
  eo.base_date,
  eo.years_count,
  eo.source_table,
  eo.source_id,
  eo.related_person_id,
  p.display_name as related_person_name,
  eo.related_entity_id,
  ee.name as related_entity_name,
  ee.slug as related_entity_slug,
  eo.related_organization_unit_id,
  ou.name as related_organization_unit_name,
  ou.slug as related_organization_unit_slug,
  eo.related_appointment_id,
  eo.related_movement_id,
  eo.diocese_id,
  d.name as diocese_name,
  d.slug as diocese_slug,
  eo.visibility,
  eo.status,
  eo.is_jubilee,
  eo.jubilee_name,
  eo.created_at
from public.event_occurrences eo
join public.event_types et on et.id=eo.event_type_id
left join public.persons p on p.id=eo.related_person_id
left join public.ecclesiastical_entities ee on ee.id=eo.related_entity_id
left join public.organization_units ou on ou.id=eo.related_organization_unit_id
left join public.ecclesiastical_entities d on d.id=eo.diocese_id
where eo.visibility='public' and eo.status='active'
union all
select
  ce.id,
  et.name,
  et.key,
  ce.title,
  ce.event_date,
  ce.event_date,
  null::integer,
  'commemorative_events'::text,
  ce.id,
  ce.related_person_id,
  p.display_name,
  ce.related_entity_id,
  ee.name,
  ee.slug,
  ce.related_organization_unit_id,
  ou.name,
  ou.slug,
  ce.related_appointment_id,
  ce.related_movement_id,
  ce.diocese_id,
  d.name,
  d.slug,
  ce.visibility,
  ce.status,
  false,
  null::text,
  ce.created_at
from public.commemorative_events ce
join public.event_types et on et.id=ce.event_type_id
left join public.persons p on p.id=ce.related_person_id
left join public.ecclesiastical_entities ee on ee.id=ce.related_entity_id
left join public.organization_units ou on ou.id=ce.related_organization_unit_id
left join public.ecclesiastical_entities d on d.id=ce.diocese_id
where ce.visibility='public' and ce.status in ('active','approved');

grant select on public.public_calendar_events to anon, authenticated;

create view public.public_current_appointments
with (security_invoker = true)
as
select
  a.id,
  a.person_id,
  p.display_name as person_name,
  p.slug as person_slug,
  p.person_type,
  o.id as office_id,
  o.name as office_name,
  o.key as office_key,
  a.entity_id,
  ee.name as entity_name,
  ee.slug as entity_slug,
  a.organization_unit_id,
  ou.name as organization_unit_name,
  ou.slug as organization_unit_slug,
  a.start_date,
  a.end_date,
  a.is_current,
  a.appointment_type,
  a.status,
  a.visibility,
  a.notes_public
from public.appointments a
join public.persons p on p.id=a.person_id
join public.offices o on o.id=a.office_id
left join public.ecclesiastical_entities ee on ee.id=a.entity_id
left join public.organization_units ou on ou.id=a.organization_unit_id
where a.visibility='public' and a.status='active' and a.is_current=true and p.visibility='public';

grant select on public.public_current_appointments to anon, authenticated;

create view public.public_person_movements
with (security_invoker = true)
as
select
  m.id,
  m.person_id,
  p.display_name as person_name,
  p.slug as person_slug,
  m.entity_id,
  ee.name as entity_name,
  ee.slug as entity_slug,
  m.organization_unit_id,
  ou.name as organization_unit_name,
  ou.slug as organization_unit_slug,
  m.movement_type,
  m.title,
  m.description,
  m.effective_date,
  m.end_date,
  m.status,
  m.visibility,
  m.created_at,
  m.updated_at
from public.movements m
join public.persons p on p.id=m.person_id
left join public.ecclesiastical_entities ee on ee.id=m.entity_id
left join public.organization_units ou on ou.id=m.organization_unit_id
where m.status='active' and m.visibility='public' and p.status='active' and p.visibility='public';

grant select on public.public_person_movements to anon, authenticated;

create view public.public_position_assignments
with (security_invoker = true)
as
select
  pa.id,
  pa.person_id,
  coalesce(p.formal_display_name,p.display_name) as person_name,
  p.slug as person_slug,
  p.person_type,
  pa.office_configuration_id,
  coalesce(pa.title_override,oc.display_name) as position_title,
  oc.key as office_configuration_key,
  br.name as base_role_name,
  sc.name as scope_name,
  cat.name as category_name,
  pa.organization_chart_id,
  ch.name as organization_chart_name,
  ch.key as organization_chart_key,
  pa.organization_unit_id,
  ou.name as organization_unit_name,
  ou.slug as organization_unit_slug,
  pa.ecclesiastical_entity_id,
  ee.name as ecclesiastical_entity_name,
  ee.slug as ecclesiastical_entity_slug,
  pred.person_id as predecessor_person_id,
  coalesce(pred_person.formal_display_name,pred_person.display_name) as predecessor_person_name,
  pred_person.slug as predecessor_person_slug,
  succ.person_id as successor_person_id,
  coalesce(succ_person.formal_display_name,succ_person.display_name) as successor_person_name,
  succ_person.slug as successor_person_slug,
  pa.start_date,
  pa.term_start_date,
  pa.term_end_date,
  pa.actual_end_date,
  pa.is_current,
  pa.assignment_status,
  pa.selection_method,
  pa.notes_public,
  pa.verification_status,
  pa.effective_date,
  pa.public_from,
  pa.public_until
from public.position_assignments pa
left join public.persons p on p.id=pa.person_id
join public.office_configurations oc on oc.id=pa.office_configuration_id
join public.office_base_roles br on br.id=oc.base_role_id
join public.office_scopes sc on sc.id=oc.scope_id
join public.office_categories cat on cat.id=oc.category_id
left join public.organization_charts ch on ch.id=pa.organization_chart_id
left join public.organization_units ou on ou.id=pa.organization_unit_id
left join public.ecclesiastical_entities ee on ee.id=pa.ecclesiastical_entity_id
left join public.position_assignments pred on pred.id=pa.predecessor_assignment_id
left join public.persons pred_person on pred_person.id=pred.person_id
left join public.position_assignments succ on succ.id=pa.successor_assignment_id
left join public.persons succ_person on succ_person.id=succ.person_id
where pa.record_status='active'
  and pa.visibility='public'
  and pa.publication_status='published'
  and coalesce(pa.public_from,pa.start_date,pa.term_start_date,current_date)<=current_date
  and (pa.public_until is null or pa.public_until>=current_date);

grant select on public.public_position_assignments to anon, authenticated;

create view public.public_position_assignments_with_hierarchy
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
  ppa.organization_chart_id,
  ppa.organization_chart_name,
  ppa.organization_chart_key,
  ppa.organization_unit_id,
  ppa.organization_unit_name,
  ppa.organization_unit_slug,
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
left join public.position_assignments pa on pa.id=ppa.id
left join public.public_entity_hierarchy_paths h on h.direct_entity_id=pa.ecclesiastical_entity_id;

grant select on public.public_position_assignments_with_hierarchy to anon, authenticated;
