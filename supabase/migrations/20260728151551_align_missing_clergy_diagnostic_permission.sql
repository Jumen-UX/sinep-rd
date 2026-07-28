begin;

create or replace function internal.admin_count_missing_clergy_profiles()
returns bigint
language sql
stable
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
  select count(distinct ordination.person_id)
  from public.ordination_events ordination
  join public.persons person_row
    on person_row.id = ordination.person_id
   and person_row.status = 'active'
  left join public.clergy_profiles profile
    on profile.person_id = ordination.person_id
  where ordination.record_status = 'active'
    and ordination.degree in ('diaconate', 'presbyterate', 'episcopate')
    and profile.person_id is null
    and auth.uid() is not null
    and app_private.current_user_can_manage_person('people.view', ordination.person_id);
$$;

revoke all on function internal.admin_count_missing_clergy_profiles()
from public, anon, authenticated;

comment on function internal.admin_count_missing_clergy_profiles() is
  'Counts missing clergy profiles only for people visible through the actor country-scoped people.view permission.';

commit;
