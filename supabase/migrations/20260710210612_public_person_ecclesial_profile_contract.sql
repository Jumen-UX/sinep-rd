grant select (
  person_id,
  degree,
  ordination_date,
  ordination_place,
  principal_ordainer_person_id,
  assistant_ordainer_1_person_id,
  assistant_ordainer_2_person_id,
  principal_ordainer_name,
  assistant_ordainer_1_name,
  assistant_ordainer_2_name,
  source_name,
  source_url,
  source_checked_at,
  verification_status,
  visibility,
  record_status,
  notes_public
) on public.ordination_events to anon, authenticated;

create or replace view public.person_public_ordination_history
with (security_invoker = true)
as
select
  oe.person_id,
  oe.degree,
  oe.ordination_date,
  oe.ordination_place,
  oe.principal_ordainer_person_id,
  coalesce(principal.display_name, oe.principal_ordainer_name) as principal_ordainer_name,
  principal.slug as principal_ordainer_slug,
  oe.assistant_ordainer_1_person_id,
  coalesce(assistant_1.display_name, oe.assistant_ordainer_1_name) as assistant_ordainer_1_name,
  assistant_1.slug as assistant_ordainer_1_slug,
  oe.assistant_ordainer_2_person_id,
  coalesce(assistant_2.display_name, oe.assistant_ordainer_2_name) as assistant_ordainer_2_name,
  assistant_2.slug as assistant_ordainer_2_slug,
  oe.source_name,
  oe.source_url,
  oe.source_checked_at,
  oe.verification_status,
  oe.notes_public
from public.ordination_events oe
left join public.persons principal on principal.id = oe.principal_ordainer_person_id
left join public.persons assistant_1 on assistant_1.id = oe.assistant_ordainer_1_person_id
left join public.persons assistant_2 on assistant_2.id = oe.assistant_ordainer_2_person_id
where oe.record_status = 'active';

create or replace view public.person_public_clerical_history
with (security_invoker = true)
as
select
  ci.person_id,
  'incardination'::text as dimension_type,
  ci.incardination_kind as dimension_key,
  coalesce(ee.name, ci.institute_name, ci.incardination_kind) as display_title,
  ci.incardination_entity_id as related_entity_id,
  ee.name as related_entity_name,
  ee.slug as related_entity_slug,
  ci.start_date,
  ci.end_date,
  ci.is_current,
  null::boolean as has_right_of_succession,
  ci.institute_name as detail_text
from public.clerical_incardinations ci
left join public.ecclesiastical_entities ee on ee.id = ci.incardination_entity_id
where ci.record_status = 'active'

union all

select
  csh.person_id,
  'canonical_status'::text,
  csh.status_type,
  csh.status_type,
  null::uuid,
  null::text,
  null::text,
  csh.start_date,
  csh.end_date,
  csh.is_current,
  null::boolean,
  null::text
from public.clerical_status_history csh
where csh.record_status = 'active'

union all

select
  er.person_id,
  'episcopal_role'::text,
  er.role_type,
  coalesce(er.title_see_name, ee.name, er.role_type),
  er.jurisdiction_entity_id,
  ee.name,
  ee.slug,
  er.start_date,
  er.end_date,
  er.is_current,
  er.has_right_of_succession,
  er.title_see_name
from public.episcopal_roles er
left join public.ecclesiastical_entities ee on ee.id = er.jurisdiction_entity_id
where er.record_status = 'active'

union all

select
  ped.person_id,
  'dignity'::text,
  ped.dignity_type,
  coalesce(ped.title_text, ped.dignity_type),
  null::uuid,
  null::text,
  null::text,
  ped.start_date,
  ped.end_date,
  ped.is_current,
  null::boolean,
  ped.title_text
from public.person_ecclesiastical_dignities ped
where ped.record_status = 'active';

revoke all on public.person_public_ordination_history from public, anon, authenticated;
revoke all on public.person_public_clerical_history from public, anon, authenticated;
grant select on public.person_public_ordination_history to anon, authenticated;
grant select on public.person_public_clerical_history to anon, authenticated;

comment on view public.person_public_ordination_history is 'Historial público canónico de los grados del Orden con ordenantes vinculados a personas cuando existen.';
comment on view public.person_public_clerical_history is 'Cronología pública unificada de incardinación, estado canónico, función episcopal y dignidades.';
