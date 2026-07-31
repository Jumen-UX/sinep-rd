begin;

create or replace view public.public_person_territorial_assignments
with (security_invoker = true)
as
select
  ppa.id as assignment_id,
  ppa.person_id,
  person.display_name as person_name,
  person.slug as person_slug,
  person.person_type,
  ppa.position_title,
  ppa.base_role_name,
  ppa.assignment_status,
  ppa.is_current,
  ppa.start_date,
  ppa.term_start_date,
  ppa.term_end_date,
  ppa.actual_end_date,
  ppa.direct_entity_name,
  ppa.direct_entity_slug,
  ppa.direct_entity_type_name,
  direct_entity.id as direct_entity_id,
  ppa.parish_name,
  ppa.parish_slug,
  parish.id as parish_id,
  ppa.zone_name,
  ppa.zone_slug,
  ppa.vicariate_name,
  ppa.vicariate_slug,
  ppa.diocese_name,
  ppa.diocese_slug,
  diocese.id as diocese_id,
  diocese.ecclesiastical_province_name,
  coalesce(
    direct_country.iso2,
    parish_country.iso2,
    diocese.country_iso2
  ) as country_iso2,
  coalesce(
    direct_country.name,
    parish_country.name,
    diocese.country_name,
    direct_entity.country,
    parish.country
  ) as country_name,
  ppa.organization_chart_name,
  ppa.organization_chart_key,
  ppa.organization_unit_name,
  ppa.hierarchy_path,
  ppa.verification_status,
  ppa.effective_date
from public.public_position_assignments_with_hierarchy ppa
join public.persons person
  on person.id = ppa.person_id
left join public.ecclesiastical_entities direct_entity
  on direct_entity.slug = ppa.direct_entity_slug
left join public.countries direct_country
  on direct_country.iso2 = direct_entity.country_iso2
left join public.ecclesiastical_entities parish
  on parish.slug = ppa.parish_slug
left join public.countries parish_country
  on parish_country.iso2 = parish.country_iso2
left join public.public_dioceses diocese
  on diocese.slug = ppa.diocese_slug
where ppa.is_current = true
  and ppa.assignment_status = 'active'
  and person.visibility = 'public';

comment on view public.public_person_territorial_assignments is
  'Asignaciones públicas vigentes de personas con contexto territorial eclesial. Usa el nombre público de la ficha para evitar tratamientos duplicados. El país representa el ámbito de servicio, no nacionalidad ni lugar de nacimiento.';

grant select on public.public_person_territorial_assignments to anon, authenticated;

commit;
