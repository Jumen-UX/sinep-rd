create or replace function app_private.calendar_entity_in_scope(
  p_entity_id uuid,
  p_scope_entity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
  with recursive lineage as (
    select p_entity_id as entity_id, array[p_entity_id]::uuid[] as visited, 0 as depth
    where p_entity_id is not null

    union all

    select relation_row.parent_entity_id,
           lineage.visited || relation_row.parent_entity_id,
           lineage.depth + 1
    from lineage
    join public.entity_relationships relation_row
      on relation_row.child_entity_id = lineage.entity_id
     and relation_row.is_current = true
     and relation_row.status = 'active'
    where lineage.depth < 25
      and relation_row.parent_entity_id is not null
      and not relation_row.parent_entity_id = any(lineage.visited)
  )
  select p_scope_entity_id is not null
     and exists (
       select 1
       from lineage
       where lineage.entity_id = p_scope_entity_id
     );
$$;

create or replace function app_private.event_occurrence_scope_entities(p_occurrence_id uuid)
returns table(entity_id uuid)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
  with occurrence_row as (
    select *
    from public.event_occurrences occurrence
    where occurrence.id = p_occurrence_id
  ), scope_candidates as (
    select occurrence.related_entity_id as entity_id
    from occurrence_row occurrence

    union all
    select occurrence.diocese_id
    from occurrence_row occurrence

    union all
    select unit_row.ecclesiastical_entity_id
    from occurrence_row occurrence
    join public.organization_units unit_row
      on unit_row.id = occurrence.related_organization_unit_id

    union all
    select coalesce(appointment.entity_id, unit_row.ecclesiastical_entity_id)
    from occurrence_row occurrence
    join public.appointments appointment
      on appointment.id = occurrence.related_appointment_id
    left join public.organization_units unit_row
      on unit_row.id = appointment.organization_unit_id

    union all
    select coalesce(movement.entity_id, unit_row.ecclesiastical_entity_id)
    from occurrence_row occurrence
    join public.movements movement
      on movement.id = occurrence.related_movement_id
    left join public.organization_units unit_row
      on unit_row.id = movement.organization_unit_id

    union all
    select person_scope.entity_id
    from occurrence_row occurrence
    cross join lateral app_private.person_scope_entities(occurrence.related_person_id) person_scope

    union all
    select person_scope.entity_id
    from occurrence_row occurrence
    cross join lateral app_private.person_scope_entities(occurrence.source_id) person_scope
    where occurrence.source_table = 'persons'

    union all
    select person_scope.entity_id
    from occurrence_row occurrence
    join public.clergy_profiles profile on profile.id = occurrence.source_id
    cross join lateral app_private.person_scope_entities(profile.person_id) person_scope
    where occurrence.source_table = 'clergy_profiles'

    union all
    select coalesce(appointment.entity_id, unit_row.ecclesiastical_entity_id)
    from occurrence_row occurrence
    join public.appointments appointment on appointment.id = occurrence.source_id
    left join public.organization_units unit_row on unit_row.id = appointment.organization_unit_id
    where occurrence.source_table = 'appointments'

    union all
    select occurrence.source_id
    from occurrence_row occurrence
    where occurrence.source_table = 'ecclesiastical_entities'

    union all
    select unit_row.ecclesiastical_entity_id
    from occurrence_row occurrence
    join public.organization_units unit_row on unit_row.id = occurrence.source_id
    where occurrence.source_table = 'organization_units'

    union all
    select coalesce(movement.entity_id, unit_row.ecclesiastical_entity_id)
    from occurrence_row occurrence
    join public.movements movement on movement.id = occurrence.source_id
    left join public.organization_units unit_row on unit_row.id = movement.organization_unit_id
    where occurrence.source_table = 'movements'

    union all
    select commemorative.related_entity_id
    from occurrence_row occurrence
    join public.commemorative_events commemorative on commemorative.id = occurrence.source_id
    where occurrence.source_table = 'commemorative_events'

    union all
    select commemorative.diocese_id
    from occurrence_row occurrence
    join public.commemorative_events commemorative on commemorative.id = occurrence.source_id
    where occurrence.source_table = 'commemorative_events'

    union all
    select unit_row.ecclesiastical_entity_id
    from occurrence_row occurrence
    join public.commemorative_events commemorative on commemorative.id = occurrence.source_id
    join public.organization_units unit_row on unit_row.id = commemorative.related_organization_unit_id
    where occurrence.source_table = 'commemorative_events'

    union all
    select person_scope.entity_id
    from occurrence_row occurrence
    join public.commemorative_events commemorative on commemorative.id = occurrence.source_id
    cross join lateral app_private.person_scope_entities(commemorative.related_person_id) person_scope
    where occurrence.source_table = 'commemorative_events'
  )
  select distinct candidate.entity_id
  from scope_candidates candidate
  where candidate.entity_id is not null;
$$;

create or replace function app_private.commemorative_event_scope_entities(p_event_id uuid)
returns table(entity_id uuid)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
  with event_row as (
    select *
    from public.commemorative_events commemorative
    where commemorative.id = p_event_id
  ), scope_candidates as (
    select commemorative.related_entity_id as entity_id
    from event_row commemorative

    union all
    select commemorative.diocese_id
    from event_row commemorative

    union all
    select unit_row.ecclesiastical_entity_id
    from event_row commemorative
    join public.organization_units unit_row
      on unit_row.id = commemorative.related_organization_unit_id

    union all
    select coalesce(appointment.entity_id, unit_row.ecclesiastical_entity_id)
    from event_row commemorative
    join public.appointments appointment
      on appointment.id = commemorative.related_appointment_id
    left join public.organization_units unit_row
      on unit_row.id = appointment.organization_unit_id

    union all
    select coalesce(movement.entity_id, unit_row.ecclesiastical_entity_id)
    from event_row commemorative
    join public.movements movement
      on movement.id = commemorative.related_movement_id
    left join public.organization_units unit_row
      on unit_row.id = movement.organization_unit_id

    union all
    select person_scope.entity_id
    from event_row commemorative
    cross join lateral app_private.person_scope_entities(commemorative.related_person_id) person_scope
  )
  select distinct candidate.entity_id
  from scope_candidates candidate
  where candidate.entity_id is not null;
$$;

create or replace function app_private.event_reminder_scope_entities(p_reminder_id uuid)
returns table(entity_id uuid)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
  with reminder_row as (
    select *
    from public.event_reminders reminder
    where reminder.id = p_reminder_id
  ), scope_candidates as (
    select reminder.scope_entity_id as entity_id
    from reminder_row reminder

    union all
    select reminder.diocese_id
    from reminder_row reminder

    union all
    select unit_row.ecclesiastical_entity_id
    from reminder_row reminder
    join public.organization_units unit_row
      on unit_row.id = reminder.organization_unit_id

    union all
    select unit_row.ecclesiastical_entity_id
    from reminder_row reminder
    join public.organization_units unit_row
      on unit_row.pastoral_area_id = reminder.pastoral_area_id
    where reminder.pastoral_area_id is not null
  )
  select distinct candidate.entity_id
  from scope_candidates candidate
  where candidate.entity_id is not null;
$$;

create or replace function app_private.event_notification_log_scope_entities(p_log_id uuid)
returns table(entity_id uuid)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
  select occurrence_scope.entity_id
  from public.event_notification_logs notification
  cross join lateral app_private.event_occurrence_scope_entities(notification.event_occurrence_id) occurrence_scope
  where notification.id = p_log_id

  union

  select reminder_scope.entity_id
  from public.event_notification_logs notification
  cross join lateral app_private.event_reminder_scope_entities(notification.event_reminder_id) reminder_scope
  where notification.id = p_log_id;
$$;

create or replace function app_private.calendar_record_scope_entities(
  p_record_table text,
  p_record_id uuid
)
returns table(entity_id uuid)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
begin
  if p_record_id is null then
    return;
  end if;

  case p_record_table
    when 'event_occurrences' then
      return query select scope_row.entity_id from app_private.event_occurrence_scope_entities(p_record_id) scope_row;
    when 'commemorative_events' then
      return query select scope_row.entity_id from app_private.commemorative_event_scope_entities(p_record_id) scope_row;
    when 'event_reminders' then
      return query select scope_row.entity_id from app_private.event_reminder_scope_entities(p_record_id) scope_row;
    when 'event_notification_logs' then
      return query select scope_row.entity_id from app_private.event_notification_log_scope_entities(p_record_id) scope_row;
    else
      return;
  end case;
end;
$$;

create or replace function app_private.current_user_can_manage_calendar_record(
  p_permission_key text,
  p_record_table text,
  p_record_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select auth.uid() is not null
     and nullif(p_permission_key, '') is not null
     and (
       exists (
         select 1
         from app_private.calendar_record_scope_entities(p_record_table, p_record_id) scope_row
         where app_private.current_user_can_manage_entity(p_permission_key, scope_row.entity_id)
       )
       or (
         not exists (
           select 1
           from app_private.calendar_record_scope_entities(p_record_table, p_record_id)
         )
         and app_private.current_user_has_role(array['super_admin'])
         and app_private.current_user_has_permission(p_permission_key)
       )
     );
$$;

create or replace function app_private.current_user_can_view_calendar_record(
  p_record_table text,
  p_record_id uuid,
  p_visibility text
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.current_user_can_manage_calendar_record(
    case
      when p_visibility in ('private','confidential') then 'events.view_private'
      else 'events.view'
    end,
    p_record_table,
    p_record_id
  );
$$;

alter table public.event_occurrences
  drop constraint if exists event_occurrences_source_table_check;

alter table public.event_occurrences
  add constraint event_occurrences_source_table_check
  check (source_table in (
    'persons',
    'clergy_profiles',
    'appointments',
    'ecclesiastical_entities',
    'organization_units',
    'pastoral_entities',
    'movements',
    'commemorative_events',
    'manual',
    'system'
  ));

drop policy if exists phase0_event_occurrences_select_fd1ac97 on public.event_occurrences;
drop policy if exists phase0_event_occurrences_insert_22534f9 on public.event_occurrences;
drop policy if exists phase0_event_occurrences_update_fedca7f on public.event_occurrences;
drop policy if exists phase0_event_occurrences_remove_e5f0de0 on public.event_occurrences;

create policy event_occurrences_select_scoped
on public.event_occurrences
for select
to public
using (
  (visibility = 'public' and status = 'active')
  or app_private.current_user_can_view_calendar_record('event_occurrences', id, visibility)
);

drop policy if exists phase0_commemorative_events_select_0e9c051 on public.commemorative_events;
drop policy if exists phase0_commemorative_events_insert_b300d27 on public.commemorative_events;
drop policy if exists phase0_commemorative_events_update_0d89d5a on public.commemorative_events;
drop policy if exists phase0_commemorative_events_remove_21899f1 on public.commemorative_events;

create policy commemorative_events_select_scoped
on public.commemorative_events
for select
to public
using (
  (visibility = 'public' and status in ('active','approved'))
  or app_private.current_user_can_view_calendar_record('commemorative_events', id, visibility)
);

drop policy if exists phase0_event_reminders_select_017a624 on public.event_reminders;
drop policy if exists phase0_event_reminders_insert_4d4674a on public.event_reminders;
drop policy if exists phase0_event_reminders_update_b5351de on public.event_reminders;
drop policy if exists phase0_event_reminders_remove_b113b26 on public.event_reminders;

create policy event_reminders_select_scoped
on public.event_reminders
for select
to authenticated
using (
  app_private.current_user_can_manage_calendar_record('events.view', 'event_reminders', id)
);

drop policy if exists phase0_event_visibility_settings_select_a90af12 on public.event_visibility_settings;
drop policy if exists phase0_event_visibility_settings_insert_22ba8c6 on public.event_visibility_settings;
drop policy if exists phase0_event_visibility_settings_update_82ddad5 on public.event_visibility_settings;
drop policy if exists phase0_event_visibility_settings_remove_aa52cf4 on public.event_visibility_settings;

create policy event_visibility_settings_select_scoped
on public.event_visibility_settings
for select
to authenticated
using (
  (
    diocese_id is not null
    and app_private.current_user_can_manage_entity('events.view', diocese_id)
  )
  or (
    diocese_id is null
    and app_private.current_user_has_role(array['super_admin'])
    and app_private.current_user_has_permission('events.view')
  )
);

drop policy if exists phase0_event_notification_logs_select_d8778f1 on public.event_notification_logs;
drop policy if exists phase0_event_notification_logs_insert_1f7a7c8 on public.event_notification_logs;
drop policy if exists phase0_event_notification_logs_update_526226c on public.event_notification_logs;
drop policy if exists phase0_event_notification_logs_remove_c08b005 on public.event_notification_logs;

create policy event_notification_logs_select_scoped
on public.event_notification_logs
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or app_private.current_user_can_manage_calendar_record('events.view', 'event_notification_logs', id)
);

revoke insert, update, delete on table public.event_occurrences from anon, authenticated;
revoke insert, update, delete on table public.commemorative_events from anon, authenticated;
revoke insert, update, delete on table public.event_reminders from anon, authenticated;
revoke insert, update, delete on table public.event_visibility_settings from anon, authenticated;
revoke insert, update, delete on table public.event_notification_logs from anon, authenticated;

alter view public.public_calendar_events set (security_invoker = true);

revoke all on function app_private.calendar_entity_in_scope(uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.event_occurrence_scope_entities(uuid) from public, anon, authenticated;
revoke all on function app_private.commemorative_event_scope_entities(uuid) from public, anon, authenticated;
revoke all on function app_private.event_reminder_scope_entities(uuid) from public, anon, authenticated;
revoke all on function app_private.event_notification_log_scope_entities(uuid) from public, anon, authenticated;
revoke all on function app_private.calendar_record_scope_entities(text, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_manage_calendar_record(text, text, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_view_calendar_record(text, uuid, text) from public, anon, authenticated;
