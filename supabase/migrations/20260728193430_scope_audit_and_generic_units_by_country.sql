create or replace function app_private.current_user_can_manage_country(
  p_permission_key text,
  p_country_iso2 char(2)
)
returns boolean
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or nullif(p_permission_key, '') is null or p_country_iso2 is null then
    return false;
  end if;

  if not exists (
    select 1 from public.profiles profile_row
    where profile_row.id = v_user_id and profile_row.status = 'active'
  ) then
    return false;
  end if;

  if app_private.current_user_has_role(array['super_admin']) then
    return app_private.current_user_has_permission(p_permission_key);
  end if;

  if not app_private.current_user_can_access_country(p_country_iso2) then
    return false;
  end if;

  return exists (
    select 1
    from public.user_role_assignments assignment
    join public.role_permissions role_permission on role_permission.role_id = assignment.role_id
    join public.permissions permission_row on permission_row.id = role_permission.permission_id
    where assignment.user_id = v_user_id
      and assignment.status = 'active'
      and assignment.starts_at <= current_date
      and (assignment.ends_at is null or assignment.ends_at >= current_date)
      and assignment.country_iso2 = p_country_iso2
      and assignment.scope_type = 'national'
      and permission_row.key = p_permission_key
  );
end;
$$;

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

  if app_private.current_user_can_manage_entity(p_permission_key, v_entity_id) then
    return true;
  end if;

  if not exists (
    select 1 from public.profiles profile_row
    where profile_row.id = v_user_id and profile_row.status = 'active'
  ) or not app_private.current_user_can_access_country(v_country_iso2) then
    return false;
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

create or replace function app_private.current_user_can_manage_pastoral_area(
  p_permission_key text,
  p_pastoral_area_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select auth.uid() is not null
     and nullif(p_permission_key, '') is not null
     and p_pastoral_area_id is not null
     and (
       exists (
         select 1
         from public.organization_units unit_row
         where unit_row.pastoral_area_id = p_pastoral_area_id
           and unit_row.status not in ('deleted', 'archived')
           and app_private.current_user_can_manage_organization_unit(
             p_permission_key,
             unit_row.id
           )
       )
       or exists (
         select 1
         from public.user_role_assignments assignment
         join public.role_permissions role_permission on role_permission.role_id = assignment.role_id
         join public.permissions permission_row on permission_row.id = role_permission.permission_id
         where assignment.user_id = auth.uid()
           and assignment.status = 'active'
           and assignment.starts_at <= current_date
           and (assignment.ends_at is null or assignment.ends_at >= current_date)
           and assignment.pastoral_area_id = p_pastoral_area_id
           and permission_row.key = p_permission_key
           and app_private.current_user_can_access_country(assignment.country_iso2)
       )
       or (
         app_private.current_user_has_role(array['super_admin'])
         and app_private.current_user_has_permission(p_permission_key)
       )
     );
$$;

create or replace function app_private.current_user_can_manage_audit_log(
  p_permission_key text,
  p_audit_log_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_log public.audit_logs%rowtype;
begin
  if auth.uid() is null
     or p_audit_log_id is null
     or nullif(p_permission_key, '') is null
     or not app_private.current_user_has_permission(p_permission_key) then
    return false;
  end if;

  select * into v_log
  from public.audit_logs audit_row
  where audit_row.id = p_audit_log_id;

  if not found then
    return false;
  end if;

  if app_private.current_user_has_role(array['super_admin']) then
    return true;
  end if;

  return (
    v_log.scope_entity_id is not null
    and app_private.current_user_can_manage_entity(p_permission_key, v_log.scope_entity_id)
  ) or (
    v_log.organization_unit_id is not null
    and app_private.current_user_can_manage_organization_unit(
      p_permission_key,
      v_log.organization_unit_id
    )
  ) or (
    v_log.pastoral_area_id is not null
    and app_private.current_user_can_manage_pastoral_area(
      p_permission_key,
      v_log.pastoral_area_id
    )
  ) or (
    v_log.country_iso2 is not null
    and app_private.current_user_can_manage_country(p_permission_key, v_log.country_iso2)
  );
end;
$$;

create or replace function app_private.admin_list_recent_audit_logs(p_limit integer default 100)
returns table(
  id uuid,
  actor_user_id uuid,
  actor_email text,
  actor_name text,
  action text,
  target_table text,
  target_id uuid,
  change_request_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('audit.view')
    or app_private.current_user_has_permission('security.view')
  ) then
    raise exception 'No autorizado para ver auditoría.' using errcode = '42501';
  end if;

  return query
  select
    audit_row.id,
    audit_row.user_id,
    profile_row.email::text,
    profile_row.full_name::text,
    audit_row.action,
    audit_row.target_table,
    audit_row.target_id,
    audit_row.change_request_id,
    audit_row.created_at
  from public.audit_logs audit_row
  left join public.profiles profile_row on profile_row.id = audit_row.user_id
  where app_private.current_user_can_manage_audit_log('audit.view', audit_row.id)
     or app_private.current_user_can_manage_audit_log('security.view', audit_row.id)
  order by audit_row.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
end;
$$;

create or replace function app_private.rpc_definer__admin_write_audit_log(
  p_action text,
  p_target_table text default null,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_log_id uuid;
  v_action text := nullif(btrim(p_action), '');
  v_target_table text := coalesce(nullif(btrim(p_target_table), ''), 'administrative_action');
  v_permission_key text;
  v_scope record;
  v_scope_allowed boolean := false;
  v_country_iso2 char(2);
begin
  if v_actor_id is null then
    raise exception 'No autenticado para registrar auditoría.' using errcode = '42501';
  end if;
  if v_action is null then
    raise exception 'La acción de auditoría es obligatoria.' using errcode = '22023';
  end if;

  v_permission_key := app_private.audit_permission_for_action(v_action);

  if not app_private.current_user_has_permission(v_permission_key) then
    raise exception 'No autorizado para registrar esta operación de auditoría.' using errcode = '42501';
  end if;

  select * into v_scope
  from app_private.resolve_audit_scope(
    v_target_table,
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb)
  );

  if v_scope.resolved_scope_entity_id is not null then
    v_country_iso2 := app_private.resolve_entity_country_iso2(v_scope.resolved_scope_entity_id);
  elsif v_scope.resolved_organization_unit_id is not null then
    select app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id)
    into v_country_iso2
    from public.organization_units unit_row
    where unit_row.id = v_scope.resolved_organization_unit_id;
  end if;

  v_scope_allowed := (
    v_scope.resolved_scope_entity_id is not null
    and app_private.current_user_can_manage_entity(
      v_permission_key,
      v_scope.resolved_scope_entity_id
    )
  ) or (
    v_scope.resolved_organization_unit_id is not null
    and app_private.current_user_can_manage_organization_unit(
      v_permission_key,
      v_scope.resolved_organization_unit_id
    )
  ) or (
    v_scope.resolved_pastoral_area_id is not null
    and app_private.current_user_can_manage_pastoral_area(
      v_permission_key,
      v_scope.resolved_pastoral_area_id
    )
  ) or (
    v_country_iso2 is not null
    and app_private.current_user_can_manage_country(v_permission_key, v_country_iso2)
  ) or app_private.current_user_has_role(array['super_admin']);

  if not v_scope_allowed then
    raise exception 'La operación de auditoría está fuera de tu alcance.' using errcode = '42501';
  end if;

  insert into public.audit_logs (
    user_id,
    action,
    target_table,
    target_id,
    new_data,
    scope_type,
    scope_entity_id,
    diocese_id,
    pastoral_area_id,
    organization_unit_id,
    permission_key,
    outcome
  ) values (
    v_actor_id,
    v_action,
    v_target_table,
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb),
    v_scope.resolved_scope_type,
    v_scope.resolved_scope_entity_id,
    v_scope.resolved_diocese_id,
    v_scope.resolved_pastoral_area_id,
    v_scope.resolved_organization_unit_id,
    v_permission_key,
    'success'
  ) returning id into v_log_id;

  return v_log_id;
end;
$$;

drop policy if exists audit_logs_insert_authenticated on public.audit_logs;
drop policy if exists audit_logs_select_allowed on public.audit_logs;

create policy audit_logs_select_scoped
on public.audit_logs
for select
to authenticated
using (
  app_private.current_user_can_manage_audit_log('audit.view', id)
  or app_private.current_user_can_manage_audit_log('security.view', id)
);

revoke insert, update, delete on table public.audit_logs from anon, authenticated;

revoke all on function app_private.current_user_can_manage_country(text, char) from public, anon, authenticated;
revoke all on function app_private.current_user_can_manage_organization_unit(text, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_manage_pastoral_area(text, uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_manage_audit_log(text, uuid) from public, anon, authenticated;
grant execute on function app_private.current_user_can_manage_audit_log(text, uuid) to authenticated;

revoke all on function public.create_audit_log(uuid, text, text, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;

comment on function app_private.current_user_can_manage_organization_unit(text, uuid)
is 'Autoriza una unidad organizativa por entidad, país, jerarquía de unidades o área pastoral sin ampliar el alcance a toda la diócesis.';

comment on function app_private.current_user_can_manage_audit_log(text, uuid)
is 'Autoriza una fila de auditoría por entidad, unidad, área pastoral o país; solo super_admin puede leer auditoría sin ámbito.';