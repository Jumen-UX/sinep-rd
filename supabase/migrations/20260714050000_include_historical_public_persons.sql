begin;

create or replace view public.person_public_directory
with (security_invoker = true)
as
select
  pes.id,
  pes.display_name,
  pes.slug,
  pes.photo_url,
  p.photo_path,
  pes.biography_public,
  pes.birth_date,
  p.age_text,
  p.death_date,
  pes.status,
  pes.visibility,
  p.created_at,
  p.updated_at,
  pes.legacy_person_type,
  pes.highest_ordination_degree,
  pes.ecclesial_condition,
  pes.is_cleric,
  pes.is_lay,
  pes.has_diaconate,
  pes.has_presbyterate,
  pes.has_episcopate,
  pes.effective_person_type as person_type,
  (rp.person_id is not null) as is_religious,
  rp.religious_life_type,
  rp.canonical_status as religious_canonical_status
from public.person_ecclesial_state pes
join public.persons p on p.id = pes.id
left join public.religious_profiles rp on rp.person_id = pes.id
where pes.visibility = 'public'
  and pes.status = any (array['active','retired','emeritus','deceased','transferred']);

create or replace view public.public_episcopal_ordinations
with (security_invoker = true)
as
select
  oe.id,
  oe.person_id as bishop_person_id,
  bishop.display_name as bishop_name,
  bishop.slug as bishop_slug,
  oe.ordination_date,
  oe.ordination_place,
  oe.principal_ordainer_person_id as principal_consecrator_person_id,
  principal.display_name as principal_consecrator_person_name,
  principal.slug as principal_consecrator_person_slug,
  oe.principal_ordainer_name as principal_consecrator_name,
  oe.assistant_ordainer_1_person_id as co_consecrator_1_person_id,
  co1.display_name as co_consecrator_1_person_name,
  co1.slug as co_consecrator_1_person_slug,
  oe.assistant_ordainer_1_name as co_consecrator_1_name,
  oe.assistant_ordainer_2_person_id as co_consecrator_2_person_id,
  co2.display_name as co_consecrator_2_person_name,
  co2.slug as co_consecrator_2_person_slug,
  oe.assistant_ordainer_2_name as co_consecrator_2_name,
  oe.source_name,
  oe.source_url,
  oe.source_checked_at,
  oe.verification_status,
  oe.notes_public,
  oe.created_at,
  oe.updated_at
from public.ordination_events oe
join public.persons bishop on bishop.id = oe.person_id
left join public.persons principal on principal.id = oe.principal_ordainer_person_id
left join public.persons co1 on co1.id = oe.assistant_ordainer_1_person_id
left join public.persons co2 on co2.id = oe.assistant_ordainer_2_person_id
where oe.degree = 'episcopate'
  and oe.record_status = 'active'
  and oe.visibility = 'public'
  and bishop.visibility = 'public'
  and bishop.status = any (array['active','retired','emeritus','deceased','transferred']);

grant select on public.person_public_directory to anon, authenticated;
grant select on public.public_episcopal_ordinations to anon, authenticated;

commit;
