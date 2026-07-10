create policy ordination_events_admin_insert_policy
on public.ordination_events
for insert
to authenticated
with check ((select public.current_user_is_admin()));

create policy ordination_events_admin_update_policy
on public.ordination_events
for update
to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()));

create policy ordination_events_admin_delete_policy
on public.ordination_events
for delete
to authenticated
using ((select public.current_user_is_admin()));

grant insert, update, delete on public.ordination_events to authenticated;

create or replace function internal.sync_person_legacy_type_trigger()
returns trigger
language plpgsql
set search_path = public, internal, pg_temp
as $$
declare
  v_person_id uuid := coalesce(new.person_id, old.person_id);
  v_degree text;
  v_current_type text;
  v_legacy_type text;
begin
  select oe.degree
  into v_degree
  from public.ordination_events oe
  where oe.person_id = v_person_id
    and oe.record_status = 'active'
  order by case oe.degree when 'episcopate' then 3 when 'presbyterate' then 2 when 'diaconate' then 1 else 0 end desc
  limit 1;

  select p.person_type
  into v_current_type
  from public.persons p
  where p.id = v_person_id
  for update;

  if not found then
    return coalesce(new, old);
  end if;

  v_legacy_type := case v_degree
    when 'episcopate' then 'bishop'
    when 'presbyterate' then 'priest'
    when 'diaconate' then 'deacon'
    else case when v_current_type in ('bishop', 'priest', 'deacon') then 'layperson' else v_current_type end
  end;

  if v_legacy_type is distinct from v_current_type then
    update public.persons
    set person_type = v_legacy_type,
        updated_at = now()
    where id = v_person_id;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function internal.sync_person_legacy_type_trigger() from public, anon, authenticated;

create trigger ordination_events_sync_person_legacy_type
after insert or update or delete on public.ordination_events
for each row execute function internal.sync_person_legacy_type_trigger();

create or replace function internal.sync_clergy_profile_ordination_events()
returns trigger
language plpgsql
set search_path = public, internal, auth, pg_temp
as $$
declare
  v_person_type text;
  v_created_by uuid;
begin
  select p.person_type, p.created_by
  into v_person_type, v_created_by
  from public.persons p
  where p.id = new.person_id;

  if new.diaconal_ordination_date is not null or v_person_type in ('deacon', 'priest', 'bishop') then
    insert into public.ordination_events (person_id, degree, ordination_date, record_origin, notes_internal, created_by)
    values (new.person_id, 'diaconate', new.diaconal_ordination_date, 'clergy_profile_compatibility',
            'Sincronizado desde clergy_profiles durante la transición al historial sacramental canónico.',
            coalesce(auth.uid(), v_created_by))
    on conflict (person_id, degree) do update set
      ordination_date = coalesce(excluded.ordination_date, public.ordination_events.ordination_date),
      updated_at = now();
  end if;

  if new.priestly_ordination_date is not null or v_person_type in ('priest', 'bishop') then
    insert into public.ordination_events (person_id, degree, ordination_date, record_origin, notes_internal, created_by)
    values (new.person_id, 'presbyterate', new.priestly_ordination_date, 'clergy_profile_compatibility',
            'Sincronizado desde clergy_profiles durante la transición al historial sacramental canónico.',
            coalesce(auth.uid(), v_created_by))
    on conflict (person_id, degree) do update set
      ordination_date = coalesce(excluded.ordination_date, public.ordination_events.ordination_date),
      updated_at = now();
  end if;

  if new.episcopal_ordination_date is not null or v_person_type = 'bishop' then
    insert into public.ordination_events (person_id, degree, ordination_date, record_origin, notes_internal, created_by)
    values (new.person_id, 'episcopate', new.episcopal_ordination_date, 'clergy_profile_compatibility',
            'Sincronizado desde clergy_profiles durante la transición al historial sacramental canónico.',
            coalesce(auth.uid(), v_created_by))
    on conflict (person_id, degree) do update set
      ordination_date = coalesce(excluded.ordination_date, public.ordination_events.ordination_date),
      updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function internal.sync_clergy_profile_ordination_events() from public, anon, authenticated;

create trigger clergy_profiles_sync_ordination_events
after insert or update of diaconal_ordination_date, priestly_ordination_date, episcopal_ordination_date
on public.clergy_profiles
for each row execute function internal.sync_clergy_profile_ordination_events();

create or replace function internal.sync_episcopal_ordination_event()
returns trigger
language plpgsql
set search_path = public, internal, pg_temp
as $$
begin
  insert into public.ordination_events (
    person_id, degree, ordination_date, ordination_place,
    principal_ordainer_person_id, assistant_ordainer_1_person_id, assistant_ordainer_2_person_id,
    principal_ordainer_name, assistant_ordainer_1_name, assistant_ordainer_2_name,
    source_name, source_url, source_checked_at, verification_status, visibility,
    record_status, record_origin, notes_public, notes_internal, created_by
  ) values (
    new.bishop_person_id, 'episcopate', new.ordination_date, new.ordination_place,
    new.principal_consecrator_person_id, new.co_consecrator_1_person_id, new.co_consecrator_2_person_id,
    new.principal_consecrator_name, new.co_consecrator_1_name, new.co_consecrator_2_name,
    new.source_name, new.source_url, new.source_checked_at, new.verification_status, new.visibility,
    case when new.status = 'active' then 'active' else 'archived' end,
    'episcopal_ordination_compatibility', new.notes_public, new.notes_internal, new.created_by
  )
  on conflict (person_id, degree) do update set
    ordination_date = coalesce(excluded.ordination_date, public.ordination_events.ordination_date),
    ordination_place = coalesce(excluded.ordination_place, public.ordination_events.ordination_place),
    principal_ordainer_person_id = coalesce(excluded.principal_ordainer_person_id, public.ordination_events.principal_ordainer_person_id),
    assistant_ordainer_1_person_id = coalesce(excluded.assistant_ordainer_1_person_id, public.ordination_events.assistant_ordainer_1_person_id),
    assistant_ordainer_2_person_id = coalesce(excluded.assistant_ordainer_2_person_id, public.ordination_events.assistant_ordainer_2_person_id),
    principal_ordainer_name = coalesce(excluded.principal_ordainer_name, public.ordination_events.principal_ordainer_name),
    assistant_ordainer_1_name = coalesce(excluded.assistant_ordainer_1_name, public.ordination_events.assistant_ordainer_1_name),
    assistant_ordainer_2_name = coalesce(excluded.assistant_ordainer_2_name, public.ordination_events.assistant_ordainer_2_name),
    source_name = coalesce(excluded.source_name, public.ordination_events.source_name),
    source_url = coalesce(excluded.source_url, public.ordination_events.source_url),
    source_checked_at = coalesce(excluded.source_checked_at, public.ordination_events.source_checked_at),
    verification_status = case when public.ordination_events.verification_status = 'verified' then 'verified' else excluded.verification_status end,
    visibility = excluded.visibility,
    record_status = excluded.record_status,
    notes_public = coalesce(excluded.notes_public, public.ordination_events.notes_public),
    notes_internal = coalesce(excluded.notes_internal, public.ordination_events.notes_internal),
    updated_at = now();

  return new;
end;
$$;

revoke all on function internal.sync_episcopal_ordination_event() from public, anon, authenticated;

create trigger episcopal_ordinations_sync_canonical_event
after insert or update on public.episcopal_ordinations
for each row execute function internal.sync_episcopal_ordination_event();
