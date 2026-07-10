alter table public.clerical_incardinations enable row level security;
alter table public.clerical_status_history enable row level security;
alter table public.episcopal_roles enable row level security;
alter table public.person_ecclesiastical_dignities enable row level security;

create policy clerical_incardinations_select_policy
on public.clerical_incardinations for select to anon, authenticated
using (
  (select public.current_user_is_admin())
  or (
    visibility = 'public' and record_status = 'active'
    and exists (
      select 1 from public.persons p
      where p.id = clerical_incardinations.person_id
        and public.can_view_visibility(p.visibility)
    )
  )
);

create policy clerical_status_history_select_policy
on public.clerical_status_history for select to anon, authenticated
using (
  (select public.current_user_is_admin())
  or (
    visibility = 'public' and record_status = 'active'
    and exists (
      select 1 from public.persons p
      where p.id = clerical_status_history.person_id
        and public.can_view_visibility(p.visibility)
    )
  )
);

create policy episcopal_roles_select_policy
on public.episcopal_roles for select to anon, authenticated
using (
  (select public.current_user_is_admin())
  or (
    visibility = 'public' and record_status = 'active'
    and exists (
      select 1 from public.persons p
      where p.id = episcopal_roles.person_id
        and public.can_view_visibility(p.visibility)
    )
  )
);

create policy person_ecclesiastical_dignities_select_policy
on public.person_ecclesiastical_dignities for select to anon, authenticated
using (
  (select public.current_user_is_admin())
  or (
    visibility = 'public' and record_status = 'active'
    and exists (
      select 1 from public.persons p
      where p.id = person_ecclesiastical_dignities.person_id
        and public.can_view_visibility(p.visibility)
    )
  )
);

revoke all on public.clerical_incardinations from public, anon, authenticated;
revoke all on public.clerical_status_history from public, anon, authenticated;
revoke all on public.episcopal_roles from public, anon, authenticated;
revoke all on public.person_ecclesiastical_dignities from public, anon, authenticated;

grant select (person_id, incardination_entity_id, institute_name, incardination_kind, start_date, end_date, is_current, visibility, record_status)
  on public.clerical_incardinations to anon, authenticated;
grant select (person_id, status_type, start_date, end_date, is_current, visibility, record_status)
  on public.clerical_status_history to anon, authenticated;
grant select (person_id, role_type, jurisdiction_entity_id, title_see_name, start_date, end_date, is_current, has_right_of_succession, visibility, record_status)
  on public.episcopal_roles to anon, authenticated;
grant select (person_id, dignity_type, title_text, start_date, end_date, is_current, visibility, record_status)
  on public.person_ecclesiastical_dignities to anon, authenticated;

create view public.person_current_clerical_state
with (security_invoker = true)
as
select
  pes.*,
  csh.status_type as canonical_status,
  ci.incardination_entity_id,
  ee.name as incardination_entity_name,
  ci.institute_name as incardination_institute_name,
  ci.incardination_kind
from public.person_ecclesial_state pes
left join public.clerical_status_history csh
  on csh.person_id = pes.id and csh.is_current = true and csh.record_status = 'active'
left join public.clerical_incardinations ci
  on ci.person_id = pes.id and ci.is_current = true and ci.record_status = 'active'
left join public.ecclesiastical_entities ee on ee.id = ci.incardination_entity_id;

create view public.person_current_episcopal_roles
with (security_invoker = true)
as
select
  er.person_id,
  p.display_name,
  p.slug,
  er.role_type,
  er.jurisdiction_entity_id,
  ee.name as jurisdiction_name,
  er.title_see_name,
  er.start_date,
  er.has_right_of_succession
from public.episcopal_roles er
join public.persons p on p.id = er.person_id
left join public.ecclesiastical_entities ee on ee.id = er.jurisdiction_entity_id
where er.is_current = true and er.record_status = 'active';

create view public.person_current_ecclesiastical_dignities
with (security_invoker = true)
as
select
  ped.person_id,
  p.display_name,
  p.slug,
  ped.dignity_type,
  ped.title_text,
  ped.start_date
from public.person_ecclesiastical_dignities ped
join public.persons p on p.id = ped.person_id
where ped.is_current = true and ped.record_status = 'active';

revoke all on public.person_current_clerical_state from public, anon, authenticated;
revoke all on public.person_current_episcopal_roles from public, anon, authenticated;
revoke all on public.person_current_ecclesiastical_dignities from public, anon, authenticated;
grant select on public.person_current_clerical_state to anon, authenticated;
grant select on public.person_current_episcopal_roles to anon, authenticated;
grant select on public.person_current_ecclesiastical_dignities to anon, authenticated;

comment on column public.clergy_profiles.incardination_entity_id is 'Campo de compatibilidad. La fuente canónica es clerical_incardinations.';
comment on column public.clergy_profiles.canonical_status is 'Campo de compatibilidad. La fuente canónica es clerical_status_history.';