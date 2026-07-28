create or replace function app_private.rpc_definer__admin_generate_calendar_occurrences(
  p_year integer,
  p_scope_entity_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope_entity_id uuid := p_scope_entity_id;
  v_scope_country char(2);
  v_affected integer := 0;
  v_audit_id uuid;
begin
  if auth.uid() is null
     or not app_private.current_user_has_permission('events.apply') then
    raise exception 'No autorizado para generar ocurrencias del calendario.' using errcode = '42501';
  end if;

  if p_year < 1500 or p_year > 2500 then
    raise exception 'El año está fuera del rango permitido.' using errcode = '22023';
  end if;

  if v_scope_entity_id is null then
    v_scope_entity_id := app_private.current_user_root_jurisdiction_id();
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_manage_entity('events.apply', v_scope_entity_id) then
    raise exception 'Debes generar el calendario dentro de una entidad de tu alcance.' using errcode = '42501';
  end if;

  v_scope_country := app_private.resolve_entity_country_iso2(v_scope_entity_id);
  if v_scope_country is null then
    raise exception 'No se pudo resolver el país del calendario.' using errcode = '22023';
  end if;

  with candidates as (
    select
      event_type.id as event_type_id,
      'Cumpleaños de ' || person_row.display_name as title,
      public.event_occurrence_date_for_year(person_row.birth_date, p_year) as occurrence_date,
      person_row.birth_date as base_date,
      p_year - extract(year from person_row.birth_date)::integer as years_count,
      'persons'::text as source_table,
      person_row.id as source_id,
      person_row.id as related_person_id,
      null::uuid as related_entity_id,
      null::uuid as related_organization_unit_id,
      null::uuid as related_appointment_id,
      app_private.resolve_entity_diocese_id(matched_scope.entity_id) as diocese_id,
      case when person_row.visibility = 'public' then event_type.default_visibility else 'internal' end as visibility,
      'active'::text as status,
      public.get_jubilee_name(
        event_type.id,
        p_year - extract(year from person_row.birth_date)::integer
      ) is not null as is_jubilee,
      public.get_jubilee_name(
        event_type.id,
        p_year - extract(year from person_row.birth_date)::integer
      ) as jubilee_name
    from public.persons person_row
    join public.event_types event_type
      on event_type.key = 'birthday' and event_type.status = 'active'
    join lateral (
      select person_scope.entity_id
      from app_private.person_scope_entities(person_row.id) person_scope
      where app_private.calendar_entity_in_scope(person_scope.entity_id, v_scope_entity_id)
        and app_private.current_user_can_manage_entity('events.apply', person_scope.entity_id)
      order by case when person_scope.entity_id = v_scope_entity_id then 0 else 1 end,
               person_scope.entity_id
      limit 1
    ) matched_scope on true
    where person_row.birth_date is not null
      and person_row.death_date is null
      and person_row.status not in ('archived','deceased')
      and p_year >= extract(year from person_row.birth_date)::integer

    union all

    select
      event_type.id,
      'Aniversario de fallecimiento de ' || person_row.display_name,
      public.event_occurrence_date_for_year(person_row.death_date, p_year),
      person_row.death_date,
      p_year - extract(year from person_row.death_date)::integer,
      'persons',
      person_row.id,
      person_row.id,
      null::uuid,
      null::uuid,
      null::uuid,
      app_private.resolve_entity_diocese_id(matched_scope.entity_id),
      case when person_row.visibility = 'public' then event_type.default_visibility else 'internal' end,
      'active',
      public.get_jubilee_name(
        event_type.id,
        p_year - extract(year from person_row.death_date)::integer
      ) is not null,
      public.get_jubilee_name(
        event_type.id,
        p_year - extract(year from person_row.death_date)::integer
      )
    from public.persons person_row
    join public.event_types event_type
      on event_type.key = 'death_anniversary' and event_type.status = 'active'
    join lateral (
      select person_scope.entity_id
      from app_private.person_scope_entities(person_row.id) person_scope
      where app_private.calendar_entity_in_scope(person_scope.entity_id, v_scope_entity_id)
        and app_private.current_user_can_manage_entity('events.apply', person_scope.entity_id)
      order by case when person_scope.entity_id = v_scope_entity_id then 0 else 1 end,
               person_scope.entity_id
      limit 1
    ) matched_scope on true
    where person_row.death_date is not null
      and person_row.status in ('deceased','archived')
      and p_year >= extract(year from person_row.death_date)::integer

    union all

    select
      event_type.id,
      'Aniversario de ' || ordination_label.label || ' de ' || person_row.display_name,
      public.event_occurrence_date_for_year(ordination_label.ordination_date, p_year),
      ordination_label.ordination_date,
      p_year - extract(year from ordination_label.ordination_date)::integer,
      'clergy_profiles',
      profile.id,
      person_row.id,
      null::uuid,
      null::uuid,
      null::uuid,
      app_private.resolve_entity_diocese_id(matched_scope.entity_id),
      case when person_row.visibility = 'public' then event_type.default_visibility else 'internal' end,
      'active',
      public.get_jubilee_name(
        event_type.id,
        p_year - extract(year from ordination_label.ordination_date)::integer
      ) is not null,
      public.get_jubilee_name(
        event_type.id,
        p_year - extract(year from ordination_label.ordination_date)::integer
      )
    from public.clergy_profiles profile
    join public.persons person_row on person_row.id = profile.person_id
    cross join lateral (
      values
        ('diaconal_ordination_anniversary'::text,'ordenación diaconal'::text,profile.diaconal_ordination_date),
        ('priestly_ordination_anniversary'::text,'ordenación sacerdotal'::text,profile.priestly_ordination_date),
        ('episcopal_ordination_anniversary'::text,'ordenación episcopal'::text,profile.episcopal_ordination_date)
    ) ordination_label(event_type_key,label,ordination_date)
    join public.event_types event_type
      on event_type.key = ordination_label.event_type_key
     and event_type.status = 'active'
    join lateral (
      select person_scope.entity_id
      from app_private.person_scope_entities(person_row.id) person_scope
      where app_private.calendar_entity_in_scope(person_scope.entity_id, v_scope_entity_id)
        and app_private.current_user_can_manage_entity('events.apply', person_scope.entity_id)
      order by case when person_scope.entity_id = v_scope_entity_id then 0 else 1 end,
               person_scope.entity_id
      limit 1
    ) matched_scope on true
    where ordination_label.ordination_date is not null
      and person_row.status <> 'archived'
      and p_year >= extract(year from ordination_label.ordination_date)::integer

    union all

    select
      event_type.id,
      case
        when entity_type.key in ('parish','quasi_parish') then
          'Aniversario de asignación de ' || person_row.display_name || ' como ' || office_row.name || ' en ' || entity_row.name
        else
          'Aniversario de nombramiento de ' || person_row.display_name || ' como ' || office_row.name
          || coalesce(' en ' || entity_row.name, '')
          || coalesce(' - ' || unit_row.name, '')
      end,
      public.event_occurrence_date_for_year(appointment.start_date, p_year),
      appointment.start_date,
      p_year - extract(year from appointment.start_date)::integer,
      'appointments',
      appointment.id,
      appointment.person_id,
      appointment.entity_id,
      appointment.organization_unit_id,
      appointment.id,
      app_private.resolve_entity_diocese_id(scope_context.entity_id),
      case
        when appointment.visibility = 'public' and person_row.visibility = 'public'
          then event_type.default_visibility
        else 'internal'
      end,
      'active',
      public.get_jubilee_name(
        event_type.id,
        p_year - extract(year from appointment.start_date)::integer
      ) is not null,
      public.get_jubilee_name(
        event_type.id,
        p_year - extract(year from appointment.start_date)::integer
      )
    from public.appointments appointment
    join public.persons person_row on person_row.id = appointment.person_id
    join public.offices office_row on office_row.id = appointment.office_id
    left join public.ecclesiastical_entities entity_row on entity_row.id = appointment.entity_id
    left join public.entity_types entity_type on entity_type.id = entity_row.entity_type_id
    left join public.organization_units unit_row on unit_row.id = appointment.organization_unit_id
    cross join lateral (
      select coalesce(appointment.entity_id, unit_row.ecclesiastical_entity_id) as entity_id
    ) scope_context
    join public.event_types event_type
      on event_type.key = case
        when entity_type.key in ('parish','quasi_parish') then 'parish_assignment_anniversary'
        else 'appointment_anniversary'
      end
     and event_type.status = 'active'
    where appointment.start_date is not null
      and appointment.status in ('active','ended')
      and scope_context.entity_id is not null
      and p_year >= extract(year from appointment.start_date)::integer
      and app_private.calendar_entity_in_scope(scope_context.entity_id, v_scope_entity_id)
      and app_private.current_user_can_manage_entity('events.apply', scope_context.entity_id)

    union all

    select
      event_type.id,
      'Aniversario de erección de ' || entity_row.name,
      public.event_occurrence_date_for_year(entity_row.erected_at, p_year),
      entity_row.erected_at,
      p_year - extract(year from entity_row.erected_at)::integer,
      'ecclesiastical_entities',
      entity_row.id,
      null::uuid,
      entity_row.id,
      null::uuid,
      null::uuid,
      app_private.resolve_entity_diocese_id(entity_row.id),
      entity_row.visibility,
      'active',
      public.get_jubilee_name(
        event_type.id,
        p_year - extract(year from entity_row.erected_at)::integer
      ) is not null,
      public.get_jubilee_name(
        event_type.id,
        p_year - extract(year from entity_row.erected_at)::integer
      )
    from public.ecclesiastical_entities entity_row
    join public.entity_types entity_type on entity_type.id = entity_row.entity_type_id
    join public.event_types event_type
      on event_type.key = case
        when entity_type.key in ('parish','quasi_parish') then 'parish_erection_anniversary'
        when entity_type.key in ('archdiocese','diocese','apostolic_vicariate') then 'diocese_erection_anniversary'
        else null
      end
     and event_type.status = 'active'
    where entity_row.erected_at is not null
      and entity_row.status <> 'archived'
      and p_year >= extract(year from entity_row.erected_at)::integer
      and app_private.calendar_entity_in_scope(entity_row.id, v_scope_entity_id)
      and app_private.current_user_can_manage_entity('events.apply', entity_row.id)

    union all

    select
      event_type.id,
      'Aniversario de creación de ' || unit_row.name,
      public.event_occurrence_date_for_year(unit_row.valid_from, p_year),
      unit_row.valid_from,
      p_year - extract(year from unit_row.valid_from)::integer,
      'organization_units',
      unit_row.id,
      null::uuid,
      null::uuid,
      unit_row.id,
      null::uuid,
      app_private.resolve_entity_diocese_id(unit_row.ecclesiastical_entity_id),
      unit_row.visibility,
      'active',
      public.get_jubilee_name(
        event_type.id,
        p_year - extract(year from unit_row.valid_from)::integer
      ) is not null,
      public.get_jubilee_name(
        event_type.id,
        p_year - extract(year from unit_row.valid_from)::integer
      )
    from public.organization_units unit_row
    join public.event_types event_type
      on event_type.key = 'pastoral_foundation_anniversary'
     and event_type.status = 'active'
    where unit_row.valid_from is not null
      and unit_row.status = 'active'
      and unit_row.is_current = true
      and unit_row.ecclesiastical_entity_id is not null
      and p_year >= extract(year from unit_row.valid_from)::integer
      and app_private.calendar_entity_in_scope(unit_row.ecclesiastical_entity_id, v_scope_entity_id)
      and app_private.current_user_can_manage_entity('events.apply', unit_row.ecclesiastical_entity_id)
  )
  insert into public.event_occurrences(
    event_type_id,title,occurrence_date,base_date,years_count,source_table,source_id,
    related_person_id,related_entity_id,related_organization_unit_id,related_appointment_id,
    diocese_id,visibility,status,is_jubilee,jubilee_name,created_at
  )
  select
    candidate.event_type_id,candidate.title,candidate.occurrence_date,candidate.base_date,
    candidate.years_count,candidate.source_table,candidate.source_id,candidate.related_person_id,
    candidate.related_entity_id,candidate.related_organization_unit_id,candidate.related_appointment_id,
    candidate.diocese_id,candidate.visibility,candidate.status,candidate.is_jubilee,candidate.jubilee_name,now()
  from candidates candidate
  on conflict (event_type_id,source_table,source_id,occurrence_date)
  where source_id is not null
  do update set
    title = excluded.title,
    base_date = excluded.base_date,
    years_count = excluded.years_count,
    related_person_id = excluded.related_person_id,
    related_entity_id = excluded.related_entity_id,
    related_organization_unit_id = excluded.related_organization_unit_id,
    related_appointment_id = excluded.related_appointment_id,
    diocese_id = excluded.diocese_id,
    visibility = excluded.visibility,
    status = excluded.status,
    is_jubilee = excluded.is_jubilee,
    jubilee_name = excluded.jubilee_name;

  get diagnostics v_affected = row_count;

  v_audit_id := public.admin_write_audit_log(
    'calendar.occurrences.generated',
    'ecclesiastical_entities',
    v_scope_entity_id,
    jsonb_build_object(
      'scope_entity_id',v_scope_entity_id,
      'country_iso2',v_scope_country,
      'year',p_year,
      'affected_occurrences',v_affected,
      'canonical_records_modified',true
    )
  );

  return jsonb_build_object(
    'year',p_year,
    'scope_entity_id',v_scope_entity_id,
    'country_iso2',v_scope_country,
    'affected_occurrences',v_affected,
    'audit_log_id',v_audit_id
  );
end;
$$;

create or replace function public.admin_generate_calendar_occurrences(
  p_year integer,
  p_scope_entity_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__admin_generate_calendar_occurrences(
    p_year,p_scope_entity_id
  );
$$;

revoke all on function app_private.rpc_definer__admin_generate_calendar_occurrences(integer, uuid) from public, anon;
grant execute on function app_private.rpc_definer__admin_generate_calendar_occurrences(integer, uuid) to authenticated;

revoke all on function public.admin_generate_calendar_occurrences(integer, uuid) from public, anon;
grant execute on function public.admin_generate_calendar_occurrences(integer, uuid) to authenticated;

revoke all on function public.generate_event_occurrences(integer) from public, anon, authenticated;
revoke all on function public.generate_current_and_next_year_events() from public, anon, authenticated;

comment on function public.generate_event_occurrences(integer) is
  'Generador global heredado reservado a operación técnica. La administración por país debe usar admin_generate_calendar_occurrences.';
comment on function public.generate_current_and_next_year_events() is
  'Generador global heredado reservado a operación técnica. La administración por país debe usar admin_generate_calendar_occurrences.';
