create or replace view public.public_ecclesiastical_place_affiliations
with (security_barrier = true)
as
select
  a.id,
  a.place_id,
  a.relationship_type,
  case
    when a.ecclesiastical_entity_id is not null then 'entity'
    when a.organization_unit_id is not null then 'organization_unit'
    else 'institution'
  end as target_kind,
  coalesce(a.ecclesiastical_entity_id, a.organization_unit_id, a.institution_id) as target_id,
  coalesce(e.name, u.name, i.name) as target_name,
  coalesce(e.slug, u.slug, i.slug) as target_slug,
  a.valid_from,
  a.valid_to,
  a.is_current,
  case when a.is_current then 'current' else 'historical' end as period_status
from public.ecclesiastical_place_affiliations a
join public.ecclesiastical_places p on p.id = a.place_id
left join public.ecclesiastical_entities e on e.id = a.ecclesiastical_entity_id
left join public.organization_units u on u.id = a.organization_unit_id
left join public.ecclesial_institutions i on i.id = a.institution_id
where p.status = 'active'
  and p.visibility = 'public'
  and a.status in ('active','inactive')
  and (
    (e.id is not null and e.status = 'active' and e.visibility = 'public')
    or (u.id is not null and u.status = 'active' and u.visibility = 'public')
    or (i.id is not null and i.status = 'active' and i.visibility = 'public')
  );

create or replace view public.public_ecclesial_institution_affiliations
with (security_barrier = true)
as
select
  a.id,
  a.institution_id,
  a.relationship_type,
  case
    when a.ecclesiastical_entity_id is not null then 'entity'
    when a.organization_unit_id is not null then 'organization_unit'
    else 'institution'
  end as target_kind,
  coalesce(a.ecclesiastical_entity_id, a.organization_unit_id, a.parent_institution_id) as target_id,
  coalesce(e.name, u.name, parent_i.name) as target_name,
  coalesce(e.slug, u.slug, parent_i.slug) as target_slug,
  a.valid_from,
  a.valid_to,
  a.is_current,
  case when a.is_current then 'current' else 'historical' end as period_status
from public.ecclesial_institution_affiliations a
join public.ecclesial_institutions i on i.id = a.institution_id
left join public.ecclesiastical_entities e on e.id = a.ecclesiastical_entity_id
left join public.organization_units u on u.id = a.organization_unit_id
left join public.ecclesial_institutions parent_i on parent_i.id = a.parent_institution_id
where i.status = 'active'
  and i.visibility = 'public'
  and a.status in ('active','inactive')
  and (
    (e.id is not null and e.status = 'active' and e.visibility = 'public')
    or (u.id is not null and u.status = 'active' and u.visibility = 'public')
    or (parent_i.id is not null and parent_i.status = 'active' and parent_i.visibility = 'public')
  );

revoke all on public.public_ecclesiastical_place_affiliations from public;
revoke all on public.public_ecclesial_institution_affiliations from public;
grant select on public.public_ecclesiastical_place_affiliations to anon, authenticated;
grant select on public.public_ecclesial_institution_affiliations to anon, authenticated;

comment on view public.public_ecclesiastical_place_affiliations is 'Public-safe current and historical affiliations for published ecclesiastical places.';
comment on view public.public_ecclesial_institution_affiliations is 'Public-safe current and historical affiliations for published ecclesial institutions.';