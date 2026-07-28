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
     and not app_private.current_user_can_manage_entity('events.view', v_root_entity_id) then
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
      'country',
      'ecclesiastical_province',
      'archdiocese',
      'diocese',
      'apostolic_vicariate',
      'military_ordinariate',
      'vicariate',
      'deanery',
      'pastoral_zone',
      'zone',
      'parish',
      'quasi_parish',
      'chapel'
    )
    and app_private.current_user_can_manage_entity('events.view', entity_row.id)
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

create or replace function public.admin_list_calendar_scope_options(
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
language sql
stable
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select *
  from app_private.rpc_definer__admin_list_calendar_scope_options(
    p_root_entity_id,
    p_limit
  );
$$;

revoke all on function app_private.rpc_definer__admin_list_calendar_scope_options(uuid, integer) from public, anon;
grant execute on function app_private.rpc_definer__admin_list_calendar_scope_options(uuid, integer) to authenticated;

revoke all on function public.admin_list_calendar_scope_options(uuid, integer) from public, anon;
grant execute on function public.admin_list_calendar_scope_options(uuid, integer) to authenticated;
