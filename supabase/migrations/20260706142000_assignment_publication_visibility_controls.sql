-- Publication and confidentiality controls for position assignments.
-- Applied to project hrvgpceqaxujlttpimdz on 2026-07-06.

alter table public.position_assignments
  add column if not exists effective_date date,
  add column if not exists public_from date,
  add column if not exists public_until date,
  add column if not exists confidential_until date,
  add column if not exists publication_status text not null default 'published';

alter table public.position_assignments
  drop constraint if exists position_assignments_publication_status_check;

alter table public.position_assignments
  add constraint position_assignments_publication_status_check check (
    publication_status = any (array['draft','internal','scheduled','published','private','archived']::text[])
  );

update public.position_assignments
set effective_date = coalesce(effective_date, start_date, term_start_date),
    public_from = case
      when public_from is not null then public_from
      when visibility = 'public' then coalesce(start_date, term_start_date, current_date)
      else null
    end,
    publication_status = case
      when visibility = 'private' then 'private'
      when visibility = 'internal' then 'internal'
      when visibility = 'public' and coalesce(public_from, start_date, term_start_date, current_date) > current_date then 'scheduled'
      when visibility = 'public' then 'published'
      else publication_status
    end,
    updated_at = now()
where effective_date is null
   or public_from is null
   or publication_status = 'published';

create or replace view public.public_position_assignments
with (security_invoker = true)
as
select
  pa.id,
  pa.person_id,
  p.display_name as person_name,
  p.slug as person_slug,
  p.person_type,
  pa.office_configuration_id,
  coalesce(pa.title_override, oc.display_name) as position_title,
  oc.key as office_configuration_key,
  br.name as base_role_name,
  sc.name as scope_name,
  cat.name as category_name,
  ch.name as organization_chart_name,
  ch.key as organization_chart_key,
  ou.name as organization_unit_name,
  ee.name as ecclesiastical_entity_name,
  ee.slug as ecclesiastical_entity_slug,
  pe.name as pastoral_entity_name,
  pe.slug as pastoral_entity_slug,
  pred.person_id as predecessor_person_id,
  pred_person.display_name as predecessor_person_name,
  pred_person.slug as predecessor_person_slug,
  succ.person_id as successor_person_id,
  succ_person.display_name as successor_person_name,
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
left join public.persons p on p.id = pa.person_id
join public.office_configurations oc on oc.id = pa.office_configuration_id
join public.office_base_roles br on br.id = oc.base_role_id
join public.office_scopes sc on sc.id = oc.scope_id
join public.office_categories cat on cat.id = oc.category_id
left join public.organization_charts ch on ch.id = pa.organization_chart_id
left join public.organization_units ou on ou.id = pa.organization_unit_id
left join public.ecclesiastical_entities ee on ee.id = pa.ecclesiastical_entity_id
left join public.pastoral_entities pe on pe.id = pa.pastoral_entity_id
left join public.position_assignments pred on pred.id = pa.predecessor_assignment_id
left join public.persons pred_person on pred_person.id = pred.person_id
left join public.position_assignments succ on succ.id = pa.successor_assignment_id
left join public.persons succ_person on succ_person.id = succ.person_id
where pa.record_status = 'active'
  and pa.visibility = 'public'
  and pa.publication_status = 'published'
  and coalesce(pa.public_from, pa.start_date, pa.term_start_date, current_date) <= current_date
  and (pa.public_until is null or pa.public_until >= current_date);
