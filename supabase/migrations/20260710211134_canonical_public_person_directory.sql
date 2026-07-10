create policy religious_profiles_public_membership_select
on public.religious_profiles
for select
to anon
using (
  exists (
    select 1
    from public.persons p
    where p.id = religious_profiles.person_id
      and p.status = 'active'
      and p.visibility = 'public'
  )
);

grant select (person_id, religious_life_type, canonical_status)
on public.religious_profiles
to anon;

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
left join lateral (
  select
    religious_profiles.person_id,
    religious_profiles.religious_life_type,
    religious_profiles.canonical_status
  from public.religious_profiles
  where religious_profiles.person_id = pes.id
  order by religious_profiles.updated_at desc
  limit 1
) rp on true
where pes.status = 'active'
  and pes.visibility = 'public';

revoke all on public.person_public_directory from public, anon, authenticated;
grant select on public.person_public_directory to anon;

comment on view public.person_public_directory is 'Directorio público canónico de personas. El grado del Orden se deriva de ordination_events y la vida consagrada se presenta como dimensión transversal.';
