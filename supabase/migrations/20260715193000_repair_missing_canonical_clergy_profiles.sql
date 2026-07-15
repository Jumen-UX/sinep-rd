-- Repara personas con ordenaciones canónicas activas que no poseen clergy_profiles.
-- La operación es idempotente, no altera perfiles existentes y no infiere
-- clasificaciones (tipo de diácono o sacerdote) que las fuentes no demuestran.

insert into public.clergy_profiles (
  person_id,
  diaconal_ordination_date,
  priestly_ordination_date,
  episcopal_ordination_date,
  canonical_status,
  clerical_history_status
)
select
  oe.person_id,
  min(oe.ordination_date) filter (where oe.degree = 'diaconate'),
  min(oe.ordination_date) filter (where oe.degree = 'presbyterate'),
  min(oe.ordination_date) filter (where oe.degree = 'episcopate'),
  'active',
  'pending'
from public.ordination_events oe
join public.persons p
  on p.id = oe.person_id
 and p.status = 'active'
left join public.clergy_profiles cp
  on cp.person_id = oe.person_id
where oe.record_status = 'active'
  and oe.degree in ('diaconate', 'presbyterate', 'episcopate')
  and cp.person_id is null
group by oe.person_id
on conflict (person_id) do nothing;

create or replace function public.admin_count_missing_clergy_profiles()
returns bigint
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select count(distinct oe.person_id)
  from public.ordination_events oe
  join public.persons p
    on p.id = oe.person_id
   and p.status = 'active'
  left join public.clergy_profiles cp
    on cp.person_id = oe.person_id
  where oe.record_status = 'active'
    and oe.degree in ('diaconate', 'presbyterate', 'episcopate')
    and cp.person_id is null
    and (
      public.current_user_is_super_or_national()
      or app_private.current_user_can_manage_person('people.view_private', oe.person_id)
    );
$$;

revoke all on function public.admin_count_missing_clergy_profiles() from public;
revoke all on function public.admin_count_missing_clergy_profiles() from anon;
grant execute on function public.admin_count_missing_clergy_profiles() to authenticated;

comment on function public.admin_count_missing_clergy_profiles() is
  'Cuenta personas administrables con ordenaciones canónicas activas y sin clergy_profiles.';
