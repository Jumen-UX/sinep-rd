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
where pes.status = 'active'
  and pes.visibility = 'public';

revoke all on public.person_public_directory from public, anon, authenticated;
grant select on public.person_public_directory to anon;
