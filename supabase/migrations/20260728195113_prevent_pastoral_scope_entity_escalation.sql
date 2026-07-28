create or replace function app_private.current_user_can_manage_organization_unit(
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
  v_has_territorial_assignment boolean := false;
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
    and unit_row.status not in ('deleted', 'archived');

  if v_entity_id is null or v_country_iso2 is null then
    return false;
  end if;

  if app_private.current_user_has_role(array['super_admin']) then
    return app_private.current_user_has_permission(p_permission_key);
  end if;

  if not exists (
    select 1 from public.profiles profile_row
    where profile_row.id = v_user_id and profile_row.status = 'active'
  ) or not app_private.current_user_can_access_country(v_country_iso2) then
    return false;
  end if;

  select exists (
    select 1
    from public.user_role_assignments assignment
    join public.role_permissions role_permission on role_permission.role_id = assignment.role_id
    join public.permissions permission_row on permission_row.id = role_permission.permission_id
    where assignment.user_id = v_user_id
      and assignment.status = 'active'
      and assignment.starts_at <= current_date
      and (assignment.ends_at is null or assignment.ends_at >= current_date)
      and assignment.country_iso2 = v_country_iso2
      and assignment.organization_unit_id is null
      and assignment.pastoral_area_id is null
      and permission_row.key = p_permission_key
  ) into v_has_territorial_assignment;

  if v_has_territorial_assignment
     and app_private.current_user_can_manage_entity(p_permission_key, v_entity_id) then
    return true;
  end if;

  return exists (
    with recursive unit_lineage as (
      select unit_row.id, unit_row.parent_unit_id
      from public.organization_units unit_row
      where unit_row.id = p_organization_unit_id

      union all

      select parent_row.id, parent_row.parent_unit_id
      from public.organization_units parent_row
      join unit_lineage child_row on child_row.parent_unit_id = parent_row.id
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
        assignment.organization_unit_id in (select lineage.id from unit_lineage lineage)
        or (
          v_pastoral_area_id is not null
          and assignment.pastoral_area_id = v_pastoral_area_id
        )
      )
  );
end;
$$;

create or replace function app_private.current_user_can_manage_calendar_unit(
  p_permission_key text,
  p_organization_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.current_user_can_manage_organization_unit(
    p_permission_key,
    p_organization_unit_id
  );
$$;

revoke all on function app_private.current_user_can_manage_organization_unit(text, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_manage_calendar_unit(text, uuid) from public, anon, authenticated;

comment on function app_private.current_user_can_manage_organization_unit(text, uuid)
is 'Autoriza una unidad por una asignación territorial real o por unidad/área pastoral; un scope_entity_id auxiliar no amplía una asignación pastoral.';