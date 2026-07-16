create or replace function app_private.import_entity_matches(p_value text)
returns uuid[]
language sql
stable
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
  with normalized as (
    select nullif(btrim(p_value), '') as value
  ), candidate as (
    select ee.id, ee.name
    from public.ecclesiastical_entities ee
    cross join normalized input
    where input.value is not null
      and ee.status = 'active'
      and (
        (input.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and ee.id = input.value::uuid)
        or lower(btrim(ee.name)) = lower(input.value)
        or lower(btrim(coalesce(ee.official_name, ''))) = lower(input.value)
        or lower(btrim(coalesce(ee.slug, ''))) = lower(input.value)
      )
      and (
        public.current_user_is_super_or_national()
        or public.current_user_can_manage_entity('imports.prepare', ee.id)
      )
    order by ee.name, ee.id
    limit 20
  )
  select coalesce(array_agg(candidate.id order by candidate.name, candidate.id), '{}'::uuid[])
  from candidate;
$function$;

create or replace function app_private.import_person_matches(p_value text)
returns uuid[]
language sql
stable
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
  with normalized as (
    select nullif(btrim(p_value), '') as value
  ), candidate as (
    select person_state.id, person_state.display_name
    from public.person_ecclesial_state person_state
    cross join normalized input
    where input.value is not null
      and person_state.status = 'active'
      and (
        (input.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and person_state.id = input.value::uuid)
        or lower(btrim(person_state.display_name)) = lower(input.value)
        or lower(btrim(coalesce(person_state.slug, ''))) = lower(input.value)
      )
      and (
        public.current_user_is_super_or_national()
        or app_private.current_user_can_manage_person('imports.prepare', person_state.id)
      )
    order by person_state.display_name, person_state.id
    limit 20
  )
  select coalesce(array_agg(candidate.id order by candidate.display_name, candidate.id), '{}'::uuid[])
  from candidate;
$function$;

create or replace function app_private.import_office_matches(p_value text)
returns uuid[]
language sql
stable
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
  with normalized as (
    select nullif(btrim(p_value), '') as value
  ), candidate as (
    select office.id, office.display_name
    from public.office_configurations office
    cross join normalized input
    where input.value is not null
      and office.status = 'active'
      and (
        (input.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' and office.id = input.value::uuid)
        or lower(btrim(office.display_name)) = lower(input.value)
        or lower(btrim(office.key)) = lower(input.value)
      )
    order by office.display_name, office.id
    limit 20
  )
  select coalesce(array_agg(candidate.id order by candidate.display_name, candidate.id), '{}'::uuid[])
  from candidate;
$function$;

revoke all on function app_private.import_entity_matches(text) from public, anon, authenticated;
revoke all on function app_private.import_person_matches(text) from public, anon, authenticated;
revoke all on function app_private.import_office_matches(text) from public, anon, authenticated;
