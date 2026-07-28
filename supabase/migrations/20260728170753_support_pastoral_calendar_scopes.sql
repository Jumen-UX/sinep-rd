create or replace function app_private.event_occurrence_scope_units(p_occurrence_id uuid)
returns table(organization_unit_id uuid)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
  with occurrence_row as (
    select *
    from public.event_occurrences occurrence
    where occurrence.id = p_occurrence_id
  ), unit_candidates as (
    select occurrence.related_organization_unit_id as organization_unit_id
    from occurrence_row occurrence

    union all
    select appointment.organization_unit_id
    from occurrence_row occurrence
    join public.appointments appointment on appointment.id = occurrence.related_appointment_id

    union all
    select movement.organization_unit_id
    from occurrence_row occurrence
    join public.movements movement on movement.id = occurrence.related_movement_id

    union all
    select occurrence.source_id
    from occurrence_row occurrence
    where occurrence.source_table = 'organization_units'

    union all
    select appointment.organization_unit_id
    from occurrence_row occurrence
    join public.appointments appointment on appointment.id = occurrence.source_id
    where occurrence.source_table = 'appointments'

    union all
    select movement.organization_unit_id
    from occurrence_row occurrence
    join public.movements movement on movement.id = occurrence.source_id
    where occurrence.source_table = 'movements'

    union all
    select commemorative.related_organization_unit_id
    from occurrence_row occurrence
    join public.commemorative_events commemorative on commemorative.id = occurrence.source_id
    where occurrence.source_table = 'commemorative_events'
  )
  select distinct candidate.organization_unit_id
  from unit_candidates candidate
  where candidate.organization_unit_id is not null;
$$;

create or replace function app_private.commemorative_event_scope_units(p_event_id uuid)
returns table(organization_unit_id uuid)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
  with event_row as (
    select *
    from public.commemorative_events commemorative
    where commemorative.id = p_event_id
  ), unit_candidates as (
    select commemorative.related_organization_unit_id as organization_unit_id
    from event_row commemorative

    union all
    select appointment.organization_unit_id
    from event_row commemorative
    join public.appointments appointment on appointment.id = commemorative.related_appointment_id

    union all
    select movement.organization_unit_id
    from event_row commemorative
    join public.movements movement on movement.id = commemorative.related_movement_id
  )
  select distinct candidate.organization_unit_id
  from unit_candidates candidate
  where candidate.organization_unit_id is not null;
$$;

create or replace function app_private.event_reminder_scope_units(p_reminder_id uuid)
returns table(organization_unit_id uuid)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
  select distinct candidate.organization_unit_id
  from (
    select reminder.organization_unit_id
    from public.event_reminders reminder
    where reminder.id = p_reminder_id

    union all

    select unit_row.id
    from public.event_reminders reminder
    join public.organization_units unit_row
      on unit_row.pastoral_area_id = reminder.pastoral_area_id
    where reminder.id = p_reminder_id
      and reminder.pastoral_area_id is not null
  ) candidate
  where candidate.organization_unit_id is not null;
$$;

create or replace function app_private.event_notification_log_scope_units(p_log_id uuid)
returns table(organization_unit_id uuid)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
  select occurrence_scope.organization_unit_id
  from public.event_notification_logs notification
  cross join lateral app_private.event_occurrence_scope_units(notification.event_occurrence_id) occurrence_scope
  where notification.id = p_log_id

  union

  select reminder_scope.organization_unit_id
  from public.event_notification_logs notification
  cross join lateral app_private.event_reminder_scope_units(notification.event_reminder_id) reminder_scope
  where notification.id = p_log_id;
$$;

create or replace function app_private.calendar_record_scope_units(
  p_record_table text,
  p_record_id uuid
)
returns table(organization_unit_id uuid)
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
      return query select scope_row.organization_unit_id from app_private.event_occurrence_scope_units(p_record_id) scope_row;
    when 'commemorative_events' then
      return query select scope_row.organization_unit_id from app_private.commemorative_event_scope_units(p_record_id) scope_row;
    when 'event_reminders' then
      return query select scope_row.organization_unit_id from app_private.event_reminder_scope_units(p_record_id) scope_row;
    when 'event_notification_logs' then
      return query select scope_row.organization_unit_id from app_private.event_notification_log_scope_units(p_record_id) scope_row;
    else
      return;
  end case;
end;
$$;

create or replace function app_private.current_user_can_manage_calendar_unit(
  p_permission_key text,
  p_organization_unit_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_user_id uuid := auth.uid();
  v_entity_id uuid;
  v_pastoral_area_id uuid;
  v_country_iso2 char(2);
begin
  if v_user_id is null
     or p_organization_unit_id is null
     or nullif(p_permission_key, '') is null then
    return false;
  end if;

  select unit_row.ecclesiastical_entity_id,
         unit_row.pastoral_area_id,
         app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id)
  into v_entity_id, v_pastoral_area_id, v_country_iso2
  from public.organization_units unit_row
  where unit_row.id = p_organization_unit_id
    and unit_row.status = 'active'
    and unit_row.is_current = true;

  if v_entity_id is null or v_country_iso2 is null then
    return false;
  end if;

  if app_private.current_user_can_manage_entity(p_permission_key, v_entity_id) then
    return true;
  end if;

  if not exists (
    select 1
    from public.profiles profile_row
    where profile_row.id = v_user_id
      and profile_row.status = 'active'
  ) or not app_private.current_user_can_access_country(v_country_iso2) then
    return false;
  end if;

  return exists (
    with recursive unit_lineage as (
      select unit_row.id, unit_row.parent_unit_id
      from public.organization_units unit_row
      where unit_row.id = p_organization_unit_id
        and unit_row.status = 'active'
        and unit_row.is_current = true

      union all

      select parent_row.id, parent_row.parent_unit_id
      from public.organization_units parent_row
      join unit_lineage child_row on child_row.parent_unit_id = parent_row.id
      where parent_row.status = 'active'
        and parent_row.is_current = true
    )
    select 1
    from public.user_role_assignments assignment
    join public.role_permissions role_permission on role_permission.role_id = assignment.role_id
    join public.permissions permission_row on permission_row.id = role_permission.permission_id
    where assignment.user_id = v_user_id
      and assignment.status = 'active'
      and assignment.starts_at <= current_date
      and (assignment.ends_at is null or assignment.ends_at >= current_date)
      and assignment.country_iso2 = v_country_iso2
      and permission_row.key = p_permission_key
      and (
        assignment.organization_unit_id in (select unit_lineage.id from unit_lineage)
        or (
          v_pastoral_area_id is not null
          and assignment.pastoral_area_id = v_pastoral_area_id
        )
      )
  );
end;
$$;

create or replace function app_private.current_user_can_access_calendar_scope_entity(
  p_permission_key text,
  p_entity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.current_user_can_manage_entity(p_permission_key, p_entity_id)
     or exists (
       select 1
       from public.organization_units unit_row
       where unit_row.ecclesiastical_entity_id = p_entity_id
         and unit_row.status = 'active'
         and unit_row.is_current = true
         and app_private.current_user_can_manage_calendar_unit(
           p_permission_key,
           unit_row.id
         )
     );
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
       or exists (
         select 1
         from app_private.calendar_record_scope_units(p_record_table, p_record_id) scope_row
         where app_private.current_user_can_manage_calendar_unit(
           p_permission_key,
           scope_row.organization_unit_id
         )
       )
       or (
         not exists (
           select 1
           from app_private.calendar_record_scope_entities(p_record_table, p_record_id)
         )
         and not exists (
           select 1
           from app_private.calendar_record_scope_units(p_record_table, p_record_id)
         )
         and app_private.current_user_has_role(array['super_admin'])
         and app_private.current_user_has_permission(p_permission_key)
       )
     );
$$;

create or replace function app_private.rpc_definer__admin_list_calendar_scope_options(
  p_root_entity_id uuid default null,
  p_limit integer default 1000
)
returns table(
  scope_entity_id uuid,
  label text,
  entity_type_key text,
  entity_type_name text,
  country_iso2 char(2),
  diocese_id uuid,
  parent_entity_id uuid
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_root_entity_id uuid := p_root_entity_id;
  v_limit integer := greatest(1, least(coalesce(p_limit, 1000), 2000));
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('events.view') then
    raise exception 'No autorizado para consultar ámbitos del calendario.' using errcode = '42501';
  end if;

  if v_root_entity_id is null then
    v_root_entity_id := app_private.current_user_root_jurisdiction_id();
  end if;

  if v_root_entity_id is not null
     and not app_private.current_user_can_access_calendar_scope_entity('events.view', v_root_entity_id) then
    raise exception 'La raíz solicitada está fuera de tu alcance de calendario.' using errcode = '42501';
  end if;

  return query
  select
    entity_row.id,
    entity_row.name::text,
    entity_type.key::text,
    coalesce(entity_type.name, entity_type.key)::text,
    app_private.resolve_entity_country_iso2(entity_row.id),
    app_private.resolve_entity_diocese_id(entity_row.id),
    parent_relation.parent_entity_id
  from public.ecclesiastical_entities entity_row
  join public.entity_types entity_type on entity_type.id = entity_row.entity_type_id
  left join lateral (
    select relationship.parent_entity_id
    from public.entity_relationships relationship
    where relationship.child_entity_id = entity_row.id
      and relationship.is_current = true
      and relationship.status = 'active'
    order by relationship.created_at desc, relationship.id
    limit 1
  ) parent_relation on true
  where entity_row.status = 'active'
    and entity_type.key in (
      'country','ecclesiastical_province','archdiocese','diocese',
      'apostolic_vicariate','military_ordinariate','vicariate','deanery',
      'pastoral_zone','zone','parish','quasi_parish','chapel'
    )
    and app_private.current_user_can_access_calendar_scope_entity('events.view', entity_row.id)
    and (
      v_root_entity_id is null
      or app_private.calendar_entity_in_scope(entity_row.id, v_root_entity_id)
    )
  order by
    app_private.resolve_entity_country_iso2(entity_row.id),
    case entity_type.key
      when 'country' then 10
      when 'ecclesiastical_province' then 20
      when 'archdiocese' then 30
      when 'diocese' then 30
      when 'apostolic_vicariate' then 30
      when 'military_ordinariate' then 30
      when 'vicariate' then 40
      when 'deanery' then 45
      when 'pastoral_zone' then 50
      when 'zone' then 50
      when 'parish' then 60
      when 'quasi_parish' then 60
      when 'chapel' then 70
      else 90
    end,
    entity_row.name,
    entity_row.id
  limit v_limit;
end;
$$;

create or replace function app_private.rpc_definer__admin_list_calendar_events(
  p_from date default current_date,
  p_to date default (current_date + interval '1 year')::date,
  p_scope_entity_id uuid default null,
  p_event_type_key text default null,
  p_include_non_public boolean default true,
  p_limit integer default 500
)
returns table(
  source_kind text,event_id uuid,event_type_id uuid,event_type_key text,event_type_name text,
  title text,event_date date,base_date date,years_count integer,related_person_id uuid,
  related_person_name text,related_entity_id uuid,related_entity_name text,
  related_organization_unit_id uuid,related_organization_unit_name text,
  related_appointment_id uuid,visibility text,status text,is_jubilee boolean,
  jubilee_name text,matched_scope_entity_id uuid,country_iso2 char(2)
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope_entity_id uuid := p_scope_entity_id;
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 2000));
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('events.view') then
    raise exception 'No autorizado para consultar el calendario administrativo.' using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'El rango de fechas del calendario es inválido.' using errcode = '22023';
  end if;

  if p_to > p_from + interval '5 years' then
    raise exception 'El rango del calendario no puede superar cinco años.' using errcode = '22023';
  end if;

  if v_scope_entity_id is null then
    v_scope_entity_id := app_private.current_user_root_jurisdiction_id();
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_access_calendar_scope_entity('events.view', v_scope_entity_id) then
    raise exception 'Debes consultar el calendario dentro de una entidad de tu alcance.' using errcode = '42501';
  end if;

  return query
  with occurrence_events as (
    select
      'occurrence'::text as source_kind, occurrence.id, occurrence.event_type_id,
      event_type.key, event_type.name, occurrence.title, occurrence.occurrence_date,
      occurrence.base_date, occurrence.years_count, occurrence.related_person_id,
      person_row.display_name, occurrence.related_entity_id, entity_row.name,
      occurrence.related_organization_unit_id, unit_row.name, occurrence.related_appointment_id,
      occurrence.visibility, occurrence.status, occurrence.is_jubilee, occurrence.jubilee_name,
      matched_scope.entity_id,
      app_private.resolve_entity_country_iso2(matched_scope.entity_id)
    from public.event_occurrences occurrence
    join public.event_types event_type on event_type.id = occurrence.event_type_id
    left join public.persons person_row on person_row.id = occurrence.related_person_id
    left join public.ecclesiastical_entities entity_row on entity_row.id = occurrence.related_entity_id
    left join public.organization_units unit_row on unit_row.id = occurrence.related_organization_unit_id
    join lateral (
      select scope_row.entity_id
      from app_private.event_occurrence_scope_entities(occurrence.id) scope_row
      where app_private.calendar_entity_in_scope(scope_row.entity_id, v_scope_entity_id)
      order by case when scope_row.entity_id = v_scope_entity_id then 0 else 1 end, scope_row.entity_id
      limit 1
    ) matched_scope on true
    where occurrence.occurrence_date between p_from and p_to
      and (p_event_type_key is null or event_type.key = p_event_type_key)
      and (p_include_non_public or (occurrence.visibility = 'public' and occurrence.status = 'active'))
      and app_private.current_user_can_manage_calendar_record(
        case when occurrence.visibility in ('private','confidential') then 'events.view_private' else 'events.view' end,
        'event_occurrences', occurrence.id
      )
  ), commemorative_events as (
    select
      'commemorative'::text, commemorative.id, commemorative.event_type_id,
      event_type.key, event_type.name, commemorative.title, commemorative.event_date,
      commemorative.event_date, null::integer, commemorative.related_person_id,
      person_row.display_name, commemorative.related_entity_id, entity_row.name,
      commemorative.related_organization_unit_id, unit_row.name, commemorative.related_appointment_id,
      commemorative.visibility, commemorative.status, false, null::text,
      matched_scope.entity_id,
      app_private.resolve_entity_country_iso2(matched_scope.entity_id)
    from public.commemorative_events commemorative
    join public.event_types event_type on event_type.id = commemorative.event_type_id
    left join public.persons person_row on person_row.id = commemorative.related_person_id
    left join public.ecclesiastical_entities entity_row on entity_row.id = commemorative.related_entity_id
    left join public.organization_units unit_row on unit_row.id = commemorative.related_organization_unit_id
    join lateral (
      select scope_row.entity_id
      from app_private.commemorative_event_scope_entities(commemorative.id) scope_row
      where app_private.calendar_entity_in_scope(scope_row.entity_id, v_scope_entity_id)
      order by case when scope_row.entity_id = v_scope_entity_id then 0 else 1 end, scope_row.entity_id
      limit 1
    ) matched_scope on true
    where commemorative.event_date between p_from and p_to
      and (p_event_type_key is null or event_type.key = p_event_type_key)
      and (p_include_non_public or (commemorative.visibility = 'public' and commemorative.status in ('active','approved')))
      and app_private.current_user_can_manage_calendar_record(
        case when commemorative.visibility in ('private','confidential') then 'events.view_private' else 'events.view' end,
        'commemorative_events', commemorative.id
      )
  )
  select *
  from (
    select * from occurrence_events
    union all
    select * from commemorative_events
  ) calendar_row
  order by calendar_row.event_date, calendar_row.title, calendar_row.event_id
  limit v_limit;
end;
$$;

create or replace function app_private.rpc_definer__admin_list_event_reminders(
  p_scope_entity_id uuid default null,
  p_include_inactive boolean default false,
  p_limit integer default 500
)
returns table(
  id uuid,event_type_id uuid,event_type_key text,event_type_name text,scope_type text,
  scope_entity_id uuid,scope_entity_name text,diocese_id uuid,organization_unit_id uuid,
  organization_unit_name text,days_before integer,channel text,recipient_role_id uuid,
  recipient_role_name text,is_active boolean,country_iso2 char(2),created_at timestamptz,updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope_entity_id uuid := p_scope_entity_id;
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 2000));
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('events.view') then
    raise exception 'No autorizado para consultar recordatorios.' using errcode = '42501';
  end if;

  if v_scope_entity_id is null then
    v_scope_entity_id := app_private.current_user_root_jurisdiction_id();
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_access_calendar_scope_entity('events.view', v_scope_entity_id) then
    raise exception 'Debes consultar recordatorios dentro de una entidad de tu alcance.' using errcode = '42501';
  end if;

  return query
  select reminder.id, reminder.event_type_id, event_type.key, event_type.name,
         reminder.scope_type, reminder.scope_entity_id, scope_entity.name,
         reminder.diocese_id, reminder.organization_unit_id, unit_row.name,
         reminder.days_before, reminder.channel, reminder.recipient_role_id,
         role_row.name, reminder.is_active,
         app_private.resolve_entity_country_iso2(reminder.scope_entity_id),
         reminder.created_at, reminder.updated_at
  from public.event_reminders reminder
  join public.event_types event_type on event_type.id = reminder.event_type_id
  join public.ecclesiastical_entities scope_entity on scope_entity.id = reminder.scope_entity_id
  left join public.organization_units unit_row on unit_row.id = reminder.organization_unit_id
  left join public.roles role_row on role_row.id = reminder.recipient_role_id
  where app_private.calendar_entity_in_scope(reminder.scope_entity_id, v_scope_entity_id)
    and app_private.current_user_can_manage_calendar_record('events.view', 'event_reminders', reminder.id)
    and (p_include_inactive or reminder.is_active)
  order by event_type.name, scope_entity.name, reminder.days_before, reminder.id
  limit v_limit;
end;
$$;

create or replace function app_private.rpc_definer__admin_list_event_visibility_settings(
  p_scope_entity_id uuid default null,
  p_limit integer default 500
)
returns table(
  id uuid,diocese_id uuid,diocese_name text,event_type_id uuid,event_type_key text,event_type_name text,
  default_visibility text,can_be_public boolean,requires_approval boolean,country_iso2 char(2),
  created_at timestamptz,updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope_entity_id uuid := p_scope_entity_id;
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 2000));
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('events.view') then
    raise exception 'No autorizado para consultar reglas de visibilidad.' using errcode = '42501';
  end if;

  if v_scope_entity_id is null then
    v_scope_entity_id := app_private.current_user_root_jurisdiction_id();
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_access_calendar_scope_entity('events.view', v_scope_entity_id) then
    raise exception 'Debes consultar la visibilidad dentro de una entidad de tu alcance.' using errcode = '42501';
  end if;

  return query
  select setting.id, setting.diocese_id, diocese.name, setting.event_type_id,
         event_type.key, event_type.name, setting.default_visibility,
         setting.can_be_public, setting.requires_approval,
         app_private.resolve_entity_country_iso2(setting.diocese_id),
         setting.created_at, setting.updated_at
  from public.event_visibility_settings setting
  join public.ecclesiastical_entities diocese on diocese.id = setting.diocese_id
  join public.event_types event_type on event_type.id = setting.event_type_id
  where app_private.calendar_entity_in_scope(setting.diocese_id, v_scope_entity_id)
    and app_private.current_user_can_access_calendar_scope_entity('events.view', setting.diocese_id)
  order by diocese.name, event_type.name, setting.id
  limit v_limit;
end;
$$;

revoke all on function app_private.event_occurrence_scope_units(uuid) from public, anon, authenticated;
revoke all on function app_private.commemorative_event_scope_units(uuid) from public, anon, authenticated;
revoke all on function app_private.event_reminder_scope_units(uuid) from public, anon, authenticated;
revoke all on function app_private.event_notification_log_scope_units(uuid) from public, anon, authenticated;
revoke all on function app_private.calendar_record_scope_units(text, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_manage_calendar_unit(text, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_access_calendar_scope_entity(text, uuid) from public, anon, authenticated;

revoke all on function app_private.current_user_can_manage_calendar_record(text, text, uuid) from public, anon, authenticated;
grant execute on function app_private.current_user_can_manage_calendar_record(text, text, uuid) to authenticated;
