begin;

create or replace function app_private.sync_clergy_profile_ordination_dates()
returns trigger
language plpgsql
set search_path = public, app_private, pg_temp
as $$
declare
  v_person_id uuid := coalesce(new.person_id, old.person_id);
begin
  update public.clergy_profiles cp
  set diaconal_ordination_date = (
        select max(oe.ordination_date)
        from public.ordination_events oe
        where oe.person_id = v_person_id
          and oe.degree = 'diaconate'
          and oe.record_status = 'active'
      ),
      priestly_ordination_date = (
        select max(oe.ordination_date)
        from public.ordination_events oe
        where oe.person_id = v_person_id
          and oe.degree = 'presbyterate'
          and oe.record_status = 'active'
      ),
      episcopal_ordination_date = (
        select max(oe.ordination_date)
        from public.ordination_events oe
        where oe.person_id = v_person_id
          and oe.degree = 'episcopate'
          and oe.record_status = 'active'
      ),
      updated_at = now()
  where cp.person_id = v_person_id;

  return coalesce(new, old);
end;
$$;

revoke all on function app_private.sync_clergy_profile_ordination_dates() from public, anon, authenticated;
grant execute on function app_private.sync_clergy_profile_ordination_dates() to service_role;

drop trigger if exists ordination_events_sync_clergy_profile_dates on public.ordination_events;
create trigger ordination_events_sync_clergy_profile_dates
after insert or delete or update of person_id, degree, ordination_date, record_status
on public.ordination_events
for each row
execute function app_private.sync_clergy_profile_ordination_dates();

with ord as (
  select person_id,
         max(ordination_date) filter (where degree = 'diaconate' and record_status = 'active') as diaconate_date,
         max(ordination_date) filter (where degree = 'presbyterate' and record_status = 'active') as presbyterate_date,
         max(ordination_date) filter (where degree = 'episcopate' and record_status = 'active') as episcopate_date
  from public.ordination_events
  group by person_id
)
update public.clergy_profiles cp
set diaconal_ordination_date = ord.diaconate_date,
    priestly_ordination_date = ord.presbyterate_date,
    episcopal_ordination_date = ord.episcopate_date,
    updated_at = now()
from ord
where ord.person_id = cp.person_id
  and (
    cp.diaconal_ordination_date is distinct from ord.diaconate_date
    or cp.priestly_ordination_date is distinct from ord.presbyterate_date
    or cp.episcopal_ordination_date is distinct from ord.episcopate_date
  );

commit;
