begin;

create or replace function app_private.admin_search_catalog(
  p_query text,
  p_limit integer default 30
)
returns table(
  result_type text,
  result_id uuid,
  title text,
  subtitle text,
  href text,
  rank integer
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_query text := nullif(btrim(p_query), '');
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 60);
begin
  if auth.uid() is null then
    raise exception 'Autenticación requerida' using errcode = '42501';
  end if;

  if v_query is null or char_length(v_query) < 2 then
    return;
  end if;

  return query
  with people as (
    select
      'person'::text as result_type,
      p.person_id as result_id,
      coalesce(p.display_name, 'Persona sin nombre') as title,
      concat_ws(' · ', nullif(p.person_type, ''), nullif(p.current_entity_name, ''), nullif(p.current_organization_unit_name, '')) as subtitle,
      '/admin/personas/' || p.person_id::text as href,
      case
        when lower(coalesce(p.display_name, '')) = lower(v_query) then 0
        when lower(coalesce(p.display_name, '')) like lower(v_query) || '%' then 10
        else 20
      end as rank
    from app_private.admin_list_people(v_query, v_limit) p
  ),
  entities as (
    select
      'entity'::text,
      e.id,
      e.name,
      concat_ws(' · ', nullif(t.name, ''), nullif(e.municipality, ''), nullif(e.province, '')),
      '/admin/jurisdicciones?entity=' || e.id::text,
      case
        when lower(e.name) = lower(v_query) then 1
        when lower(e.name) like lower(v_query) || '%' then 11
        else 21
      end
    from public.ecclesiastical_entities e
    left join public.entity_types t on t.id = e.entity_type_id
    where app_private.current_user_has_permission('entities.view')
      and e.status not in ('deleted', 'archived')
      and (
        e.name ilike '%' || v_query || '%'
        or e.official_name ilike '%' || v_query || '%'
        or e.slug ilike '%' || v_query || '%'
      )
      and (
        app_private.current_user_can('entities.view', 'national')
        or app_private.current_user_can('entities.view', 'parish', e.id)
      )
    limit v_limit
  ),
  units as (
    select
      'organization_unit'::text,
      u.id,
      u.name,
      concat_ws(' · ', nullif(c.name, ''), nullif(e.name, '')),
      '/admin/organizacion?unit=' || u.id::text,
      case
        when lower(u.name) = lower(v_query) then 2
        when lower(u.name) like lower(v_query) || '%' then 12
        else 22
      end
    from public.organization_units u
    join public.organization_charts c on c.id = u.organization_chart_id
    left join public.ecclesiastical_entities e on e.id = u.ecclesiastical_entity_id
    where app_private.current_user_has_permission('pastorals.view')
      and u.status not in ('deleted', 'archived')
      and u.name ilike '%' || v_query || '%'
      and (
        app_private.current_user_can('pastorals.view', 'national')
        or app_private.current_user_can('pastorals.view', 'organization_unit', u.id)
        or app_private.current_user_can('pastorals.view', 'parish', u.ecclesiastical_entity_id)
      )
    limit v_limit
  )
  select *
  from (
    select * from people
    union all
    select * from entities
    union all
    select * from units
  ) results
  order by results.rank, results.title
  limit v_limit;
end;
$$;

create or replace function public.admin_search_catalog(
  p_query text,
  p_limit integer default 30
)
returns table(
  result_type text,
  result_id uuid,
  title text,
  subtitle text,
  href text,
  rank integer
)
language sql
stable
set search_path = public, app_private, pg_temp
as $$
  select * from app_private.admin_search_catalog(p_query, p_limit);
$$;

revoke all on function app_private.admin_search_catalog(text, integer) from public, anon, authenticated;
revoke all on function public.admin_search_catalog(text, integer) from public, anon;
grant execute on function public.admin_search_catalog(text, integer) to authenticated;

commit;
