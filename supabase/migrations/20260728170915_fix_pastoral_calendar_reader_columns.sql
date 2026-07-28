create or replace function app_private.rpc_definer__admin_list_calendar_events(
  p_from date default current_date,
  p_to date default (current_date + interval '1 year')::date,
  p_scope_entity_id uuid default null,
  p_event_type_key text default null,
  p_include_non_public boolean default true,
  p_limit integer default 500
)
returns table(
  source_kind text,
  event_id uuid,
  event_type_id uuid,
  event_type_key text,
  event_type_name text,
  title text,
  event_date date,
  base_date date,
  years_count integer,
  related_person_id uuid,
  related_person_name text,
  related_entity_id uuid,
  related_entity_name text,
  related_organization_unit_id uuid,
  related_organization_unit_name text,
  related_appointment_id uuid,
  visibility text,
  status text,
  is_jubilee boolean,
  jubilee_name text,
  matched_scope_entity_id uuid,
  country_iso2 char(2)
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
      'occurrence'::text as source_kind,
      occurrence.id as event_id,
      occurrence.event_type_id,
      event_type.key as event_type_key,
      event_type.name as event_type_name,
      occurrence.title,
      occurrence.occurrence_date as event_date,
      occurrence.base_date,
      occurrence.years_count,
      occurrence.related_person_id,
      person_row.display_name as related_person_name,
      occurrence.related_entity_id,
      entity_row.name as related_entity_name,
      occurrence.related_organization_unit_id,
      unit_row.name as related_organization_unit_name,
      occurrence.related_appointment_id,
      occurrence.visibility,
      occurrence.status,
      occurrence.is_jubilee,
      occurrence.jubilee_name,
      matched_scope.entity_id as matched_scope_entity_id,
      app_private.resolve_entity_country_iso2(matched_scope.entity_id) as country_iso2
    from public.event_occurrences occurrence
    join public.event_types event_type on event_type.id = occurrence.event_type_id
    left join public.persons person_row on person_row.id = occurrence.related_person_id
    left join public.ecclesiastical_entities entity_row on entity_row.id = occurrence.related_entity_id
    left join public.organization_units unit_row on unit_row.id = occurrence.related_organization_unit_id
    join lateral (
      select scope_row.entity_id
      from app_private.event_occurrence_scope_entities(occurrence.id) scope_row
      where app_private.calendar_entity_in_scope(scope_row.entity_id, v_scope_entity_id)
      order by
        case when scope_row.entity_id = v_scope_entity_id then 0 else 1 end,
        scope_row.entity_id
      limit 1
    ) matched_scope on true
    where occurrence.occurrence_date between p_from and p_to
      and (p_event_type_key is null or event_type.key = p_event_type_key)
      and (
        p_include_non_public
        or (occurrence.visibility = 'public' and occurrence.status = 'active')
      )
      and app_private.current_user_can_manage_calendar_record(
        case
          when occurrence.visibility in ('private','confidential') then 'events.view_private'
          else 'events.view'
        end,
        'event_occurrences',
        occurrence.id
      )
  ), commemorative_events as (
    select
      'commemorative'::text as source_kind,
      commemorative.id as event_id,
      commemorative.event_type_id,
      event_type.key as event_type_key,
      event_type.name as event_type_name,
      commemorative.title,
      commemorative.event_date,
      commemorative.event_date as base_date,
      null::integer as years_count,
      commemorative.related_person_id,
      person_row.display_name as related_person_name,
      commemorative.related_entity_id,
      entity_row.name as related_entity_name,
      commemorative.related_organization_unit_id,
      unit_row.name as related_organization_unit_name,
      commemorative.related_appointment_id,
      commemorative.visibility,
      commemorative.status,
      false as is_jubilee,
      null::text as jubilee_name,
      matched_scope.entity_id as matched_scope_entity_id,
      app_private.resolve_entity_country_iso2(matched_scope.entity_id) as country_iso2
    from public.commemorative_events commemorative
    join public.event_types event_type on event_type.id = commemorative.event_type_id
    left join public.persons person_row on person_row.id = commemorative.related_person_id
    left join public.ecclesiastical_entities entity_row on entity_row.id = commemorative.related_entity_id
    left join public.organization_units unit_row on unit_row.id = commemorative.related_organization_unit_id
    join lateral (
      select scope_row.entity_id
      from app_private.commemorative_event_scope_entities(commemorative.id) scope_row
      where app_private.calendar_entity_in_scope(scope_row.entity_id, v_scope_entity_id)
      order by
        case when scope_row.entity_id = v_scope_entity_id then 0 else 1 end,
        scope_row.entity_id
      limit 1
    ) matched_scope on true
    where commemorative.event_date between p_from and p_to
      and (p_event_type_key is null or event_type.key = p_event_type_key)
      and (
        p_include_non_public
        or (
          commemorative.visibility = 'public'
          and commemorative.status in ('active','approved')
        )
      )
      and app_private.current_user_can_manage_calendar_record(
        case
          when commemorative.visibility in ('private','confidential') then 'events.view_private'
          else 'events.view'
        end,
        'commemorative_events',
        commemorative.id
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
