create or replace function app_private.role_assignment_scope_label(p_assignment_id uuid)
returns text
language sql
stable
security definer
set search_path = 'pg_catalog','public','app_private','pg_temp'
as $$
  select case assignment.scope_type
    when 'global' then 'Global técnico'
    when 'national' then coalesce(entity_row.name,'País sin nombre')
    when 'diocese' then coalesce(entity_row.name,'Diócesis sin nombre')
    when 'vicariate' then coalesce(node_row.name,'Vicaría sin nombre')
    when 'zone' then coalesce(node_row.name,'Zona sin nombre')
    when 'parish' then coalesce(entity_row.name,'Parroquia sin nombre')
    when 'pastoral_area' then coalesce(area_row.name,'Área pastoral sin nombre')
    when 'organization_unit' then coalesce(unit_row.name,'Unidad organizativa sin nombre')
    when 'entity' then coalesce(node_row.name,entity_row.name,'Entidad sin nombre')
    else coalesce(node_row.name,unit_row.name,area_row.name,entity_row.name,assignment.scope_type)
  end
  from public.user_role_assignments assignment
  left join public.ecclesiastical_entities entity_row on entity_row.id=assignment.scope_entity_id
  left join public.structure_nodes node_row on node_row.id=assignment.structure_node_id
  left join public.pastoral_areas area_row on area_row.id=assignment.pastoral_area_id
  left join public.organization_units unit_row on unit_row.id=assignment.organization_unit_id
  where assignment.id=p_assignment_id;
$$;

create or replace function app_private.admin_list_users()
returns table(
  user_id uuid,email text,full_name text,phone text,profile_status text,
  auth_created_at timestamptz,email_confirmed_at timestamptz,last_sign_in_at timestamptz,
  active_roles jsonb,active_permissions jsonb
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog','public','app_private','auth','pg_temp'
as $$
declare
  v_is_super boolean := app_private.current_user_has_role(array['super_admin']);
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('users.view') or v_is_super
  ) then
    raise exception 'No autorizado para ver usuarios' using errcode='42501';
  end if;

  return query
  select auth_user.id,coalesce(profile_row.email,auth_user.email)::text,
         profile_row.full_name::text,profile_row.phone::text,
         coalesce(profile_row.status,'pending')::text,auth_user.created_at,
         auth_user.email_confirmed_at,auth_user.last_sign_in_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'assignment_id',assignment.id,'role_id',role_row.id,
             'role_key',role_row.key,'role_name',role_row.name,
             'scope_type',assignment.scope_type,
             'scope_label',app_private.role_assignment_scope_label(assignment.id),
             'scope_entity_id',assignment.scope_entity_id,
             'structure_node_id',assignment.structure_node_id,
             'country_iso2',assignment.country_iso2,
             'diocese_id',assignment.diocese_id,
             'pastoral_area_id',assignment.pastoral_area_id,
             'organization_unit_id',assignment.organization_unit_id,
             'starts_at',assignment.starts_at,'ends_at',assignment.ends_at,
             'status',assignment.status
           ) order by role_row.key,assignment.scope_type)
           from public.user_role_assignments assignment
           join public.roles role_row on role_row.id=assignment.role_id
           where assignment.user_id=auth_user.id
             and assignment.status='active'
             and assignment.starts_at<=current_date
             and (assignment.ends_at is null or assignment.ends_at>=current_date)
             and (v_is_super or assignment.country_iso2 is not null
                  and app_private.current_user_can_access_country(assignment.country_iso2))
         ),'[]'::jsonb),
         coalesce((
           select jsonb_agg(distinct jsonb_build_object(
             'key',permission_row.key,'module',permission_row.module,
             'description',permission_row.description
           ))
           from public.user_role_assignments assignment
           join public.role_permissions role_permission on role_permission.role_id=assignment.role_id
           join public.permissions permission_row on permission_row.id=role_permission.permission_id
           where assignment.user_id=auth_user.id
             and assignment.status='active'
             and assignment.starts_at<=current_date
             and (assignment.ends_at is null or assignment.ends_at>=current_date)
             and (v_is_super or assignment.country_iso2 is not null
                  and app_private.current_user_can_access_country(assignment.country_iso2))
         ),'[]'::jsonb)
  from auth.users auth_user
  left join public.profiles profile_row on profile_row.id=auth_user.id
  where app_private.current_user_can_manage_user(auth_user.id)
  order by auth_user.created_at desc;
end;
$$;

create or replace function app_private.get_my_onboarding_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = 'pg_catalog','public','app_private','auth','pg_temp'
as $$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode='42501';
  end if;

  select jsonb_build_object(
    'user_id',profile_row.id,
    'email',profile_row.email,
    'full_name',profile_row.full_name,
    'phone',profile_row.phone,
    'profile_status',profile_row.status,
    'onboarding_step',profile_row.onboarding_step,
    'onboarding_completed_at',profile_row.onboarding_completed_at,
    'roles',coalesce((
      select jsonb_agg(jsonb_build_object(
        'assignment_id',assignment.id,
        'role_key',role_row.key,
        'role_name',role_row.name,
        'scope_type',assignment.scope_type,
        'scope_label',app_private.role_assignment_scope_label(assignment.id),
        'scope_entity_id',assignment.scope_entity_id,
        'structure_node_id',assignment.structure_node_id,
        'country_iso2',assignment.country_iso2,
        'diocese_id',assignment.diocese_id,
        'pastoral_area_id',assignment.pastoral_area_id,
        'organization_unit_id',assignment.organization_unit_id
      ) order by role_row.name,assignment.scope_type)
      from public.user_role_assignments assignment
      join public.roles role_row on role_row.id=assignment.role_id
      where assignment.user_id=profile_row.id
        and assignment.status='active'
        and assignment.starts_at<=current_date
        and (assignment.ends_at is null or assignment.ends_at>=current_date)
    ),'[]'::jsonb)
  ) into v_context
  from public.profiles profile_row
  where profile_row.id=v_user_id;

  if v_context is null then
    raise exception 'Perfil de acceso no encontrado' using errcode='22023';
  end if;
  return v_context;
end;
$$;

revoke all on function app_private.role_assignment_scope_label(uuid) from public,anon,authenticated;

grant execute on function app_private.admin_list_users() to authenticated;
grant execute on function app_private.get_my_onboarding_context() to authenticated;

comment on function app_private.role_assignment_scope_label(uuid)
is 'Resuelve la etiqueta de una asignación usando la tabla canónica correspondiente a su scope_type.';