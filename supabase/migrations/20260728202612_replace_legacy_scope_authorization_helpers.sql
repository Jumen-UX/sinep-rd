alter table public.user_role_assignments
  drop constraint if exists user_role_assignments_scope_target_check;

alter table public.user_role_assignments
  add constraint user_role_assignments_scope_target_check
  check (
    (scope_type = 'global'
      and scope_entity_id is null
      and country_iso2 is null
      and diocese_id is null
      and pastoral_area_id is null
      and organization_unit_id is null
      and structure_node_id is null)
    or (scope_type = 'national'
      and scope_entity_id is not null
      and country_iso2 is not null
      and diocese_id is null
      and pastoral_area_id is null
      and organization_unit_id is null
      and structure_node_id is null)
    or (scope_type = 'diocese'
      and scope_entity_id is not null
      and diocese_id is not null
      and country_iso2 is not null
      and pastoral_area_id is null
      and organization_unit_id is null
      and structure_node_id is null)
    or (scope_type in ('vicariate','zone')
      and structure_node_id is not null
      and country_iso2 is not null
      and pastoral_area_id is null
      and organization_unit_id is null)
    or (scope_type = 'parish'
      and scope_entity_id is not null
      and country_iso2 is not null
      and pastoral_area_id is null
      and organization_unit_id is null
      and structure_node_id is null)
    or (scope_type = 'entity'
      and (scope_entity_id is not null or structure_node_id is not null)
      and country_iso2 is not null
      and pastoral_area_id is null
      and organization_unit_id is null)
    or (scope_type = 'pastoral_area'
      and pastoral_area_id is not null
      and country_iso2 is not null
      and organization_unit_id is null
      and structure_node_id is null)
    or (scope_type = 'organization_unit'
      and organization_unit_id is not null
      and country_iso2 is not null
      and structure_node_id is null)
  ) not valid;

alter table public.user_role_assignments
  validate constraint user_role_assignments_scope_target_check;

create or replace function app_private.current_user_can_manage_scope(
  p_permission_key text,
  p_scope_type text,
  p_scope_entity_id uuid default null,
  p_diocese_id uuid default null,
  p_pastoral_area_id uuid default null,
  p_organization_unit_id uuid default null,
  p_structure_node_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope_type text := app_private.normalize_authorization_scope_type(p_scope_type);
  v_country_iso2 char(2);
  v_entity_id uuid;
  v_structure_node_id uuid;
begin
  if auth.uid() is null or nullif(p_permission_key,'') is null or v_scope_type is null then
    return false;
  end if;

  if v_scope_type = 'global' then
    return app_private.current_user_has_role(array['super_admin'])
       and app_private.current_user_has_permission(p_permission_key);
  end if;

  if v_scope_type = 'national' then
    v_country_iso2 := app_private.resolve_scope_country_iso2(
      v_scope_type,p_scope_entity_id,p_diocese_id,p_pastoral_area_id,
      p_organization_unit_id,p_structure_node_id
    );
    return v_country_iso2 is not null
       and app_private.current_user_can_manage_country(p_permission_key,v_country_iso2);
  end if;

  if v_scope_type in ('diocese','parish') then
    v_entity_id := coalesce(p_scope_entity_id,p_diocese_id);
    return v_entity_id is not null
       and app_private.current_user_can_manage_entity(p_permission_key,v_entity_id);
  end if;

  if v_scope_type = 'entity' then
    if p_structure_node_id is not null then
      return app_private.current_user_can_manage_structure_node(
        p_permission_key,p_structure_node_id
      );
    end if;
    if p_scope_entity_id is not null
       and exists (
         select 1 from public.structure_nodes node_row
         where node_row.id=p_scope_entity_id
       ) then
      return app_private.current_user_can_manage_structure_node(
        p_permission_key,p_scope_entity_id
      );
    end if;
    return p_scope_entity_id is not null
       and app_private.current_user_can_manage_entity(p_permission_key,p_scope_entity_id);
  end if;

  if v_scope_type in ('vicariate','zone') then
    v_structure_node_id := coalesce(p_structure_node_id,p_scope_entity_id);
    return v_structure_node_id is not null
       and app_private.current_user_can_manage_structure_node(
         p_permission_key,v_structure_node_id
       );
  end if;

  if v_scope_type = 'pastoral_area' then
    return coalesce(p_pastoral_area_id,p_scope_entity_id) is not null
       and app_private.current_user_can_manage_pastoral_area(
         p_permission_key,coalesce(p_pastoral_area_id,p_scope_entity_id)
       );
  end if;

  if v_scope_type = 'organization_unit' then
    return coalesce(p_organization_unit_id,p_scope_entity_id) is not null
       and app_private.current_user_can_manage_organization_unit(
         p_permission_key,coalesce(p_organization_unit_id,p_scope_entity_id)
       );
  end if;

  if v_scope_type = 'person' then
    return p_scope_entity_id is not null
       and app_private.current_user_can_manage_person(p_permission_key,p_scope_entity_id);
  end if;

  return false;
end;
$$;

create or replace function app_private.current_user_has_scope_access(
  p_scope_type text,
  p_scope_entity_id uuid default null,
  p_diocese_id uuid default null,
  p_pastoral_area_id uuid default null,
  p_organization_unit_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_user_id uuid := auth.uid();
  v_scope_type text := app_private.normalize_authorization_scope_type(p_scope_type);
  v_country_iso2 char(2);
  v_structure_node_id uuid;
begin
  if v_user_id is null or v_scope_type is null then
    return false;
  end if;
  if not exists (
    select 1 from public.profiles profile_row
    where profile_row.id=v_user_id and profile_row.status='active'
  ) then
    return false;
  end if;
  if app_private.current_user_has_role(array['super_admin']) then
    return true;
  end if;

  if v_scope_type in ('vicariate','zone') then
    v_structure_node_id := p_scope_entity_id;
  end if;
  v_country_iso2 := app_private.resolve_scope_country_iso2(
    v_scope_type,
    case when v_structure_node_id is null then p_scope_entity_id else null end,
    p_diocese_id,p_pastoral_area_id,p_organization_unit_id,v_structure_node_id
  );
  if v_country_iso2 is null or not app_private.current_user_can_access_country(v_country_iso2) then
    return false;
  end if;

  return exists (
    with recursive node_lineage as (
      select node_row.id,node_row.parent_node_id
      from public.structure_nodes node_row
      where node_row.id=v_structure_node_id
      union all
      select parent_row.id,parent_row.parent_node_id
      from public.structure_nodes parent_row
      join node_lineage child_row on child_row.parent_node_id=parent_row.id
    ), unit_lineage as (
      select unit_row.id,unit_row.parent_unit_id
      from public.organization_units unit_row
      where unit_row.id=coalesce(p_organization_unit_id,
        case when v_scope_type='organization_unit' then p_scope_entity_id end)
      union all
      select parent_row.id,parent_row.parent_unit_id
      from public.organization_units parent_row
      join unit_lineage child_row on child_row.parent_unit_id=parent_row.id
    )
    select 1
    from public.user_role_assignments assignment
    where assignment.user_id=v_user_id
      and assignment.status='active'
      and assignment.starts_at<=current_date
      and (assignment.ends_at is null or assignment.ends_at>=current_date)
      and assignment.country_iso2=v_country_iso2
      and (
        assignment.scope_type='national'
        or (v_scope_type='diocese' and assignment.diocese_id is not distinct from coalesce(p_diocese_id,p_scope_entity_id))
        or (v_scope_type in ('parish','entity') and assignment.scope_entity_id is not distinct from p_scope_entity_id)
        or (v_scope_type in ('vicariate','zone','entity') and assignment.structure_node_id in (select id from node_lineage))
        or (v_scope_type='pastoral_area' and assignment.pastoral_area_id is not distinct from coalesce(p_pastoral_area_id,p_scope_entity_id))
        or (v_scope_type='organization_unit' and assignment.organization_unit_id in (select id from unit_lineage))
      )
  );
end;
$$;

create or replace function app_private.current_user_can(
  p_permission_key text,
  p_scope_type text default 'national',
  p_scope_entity_id uuid default null,
  p_diocese_id uuid default null,
  p_pastoral_area_id uuid default null,
  p_organization_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.current_user_can_manage_scope(
    p_permission_key,p_scope_type,p_scope_entity_id,p_diocese_id,
    p_pastoral_area_id,p_organization_unit_id,null
  );
$$;

create or replace function app_private.current_user_can_manage_change_request(
  p_permission_key text,
  p_change_request_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_request public.change_requests%rowtype;
  v_scope_type text;
begin
  if auth.uid() is null or p_change_request_id is null or nullif(p_permission_key,'') is null then
    return false;
  end if;

  select * into v_request
  from public.change_requests request_row
  where request_row.id=p_change_request_id;
  if not found then
    return false;
  end if;

  if v_request.target_table='persons' and v_request.target_id is not null then
    return app_private.current_user_can_manage_person(p_permission_key,v_request.target_id);
  end if;
  if v_request.target_table='ecclesiastical_entities' and v_request.target_id is not null then
    return app_private.current_user_can_manage_entity(p_permission_key,v_request.target_id);
  end if;
  if v_request.target_table='organization_units' and v_request.target_id is not null then
    return app_private.current_user_can_manage_organization_unit(p_permission_key,v_request.target_id);
  end if;

  v_scope_type := app_private.normalize_authorization_scope_type(v_request.scope_type);
  if v_scope_type is null and v_request.organization_unit_id is not null then
    v_scope_type := 'organization_unit';
  elsif v_scope_type is null and v_request.pastoral_area_id is not null then
    v_scope_type := 'pastoral_area';
  elsif v_scope_type is null and coalesce(v_request.scope_entity_id,v_request.diocese_id) is not null then
    v_scope_type := 'entity';
  end if;

  return app_private.current_user_can_manage_scope(
    p_permission_key,
    v_scope_type,
    v_request.scope_entity_id,
    v_request.diocese_id,
    v_request.pastoral_area_id,
    v_request.organization_unit_id,
    null
  );
end;
$$;

create or replace function app_private.admin_list_role_scope_options(p_scope_type text default null)
returns table(
  scope_type text,
  scope_entity_id uuid,
  label text,
  description text,
  source_table text,
  diocese_id uuid,
  parent_id uuid
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_requested text := case
    when nullif(btrim(p_scope_type),'') is null then null
    else app_private.normalize_authorization_scope_type(p_scope_type)
  end;
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('users.view')
    or app_private.current_user_has_permission('users.assign_roles')
    or app_private.current_user_has_role(array['super_admin'])
  ) then
    raise exception 'No autorizado para ver alcances de roles' using errcode='42501';
  end if;

  if p_scope_type is not null and v_requested is null then
    raise exception 'El tipo de alcance solicitado no es válido.' using errcode='22023';
  end if;

  return query
  select 'national'::text,entity_row.id,entity_row.name::text,
         coalesce(catalog.name_es,catalog.name_en,'País')::text,
         'ecclesiastical_entities'::text,null::uuid,null::uuid
  from public.ecclesiastical_entities entity_row
  join public.entity_types type_row on type_row.id=entity_row.entity_type_id and type_row.key='country'
  join public.country_catalog catalog on catalog.iso2=entity_row.country_iso2
  where (v_requested is null or v_requested='national')
    and entity_row.status='active'
    and (
      app_private.current_user_has_role(array['super_admin'])
      or app_private.current_user_can_access_country(entity_row.country_iso2)
    )
  union all
  select 'diocese'::text,entity_row.id,entity_row.name::text,
         coalesce(type_row.name,type_row.key,'Jurisdicción')::text,
         'ecclesiastical_entities'::text,entity_row.id,null::uuid
  from public.ecclesiastical_entities entity_row
  join public.entity_types type_row on type_row.id=entity_row.entity_type_id
  where (v_requested is null or v_requested='diocese')
    and entity_row.status='active'
    and type_row.key in ('archdiocese','diocese','military_ordinariate','apostolic_vicariate','apostolic_prefecture')
    and (
      app_private.current_user_has_role(array['super_admin'])
      or app_private.current_user_can_access_country(entity_row.country_iso2)
    )
  union all
  select 'parish'::text,entity_row.id,entity_row.name::text,
         coalesce(type_row.name,type_row.key,'Parroquia')::text,
         'ecclesiastical_entities'::text,
         app_private.resolve_entity_diocese_id(entity_row.id),null::uuid
  from public.ecclesiastical_entities entity_row
  join public.entity_types type_row on type_row.id=entity_row.entity_type_id
  where (v_requested is null or v_requested='parish')
    and entity_row.status='active'
    and type_row.key in ('parish','quasi_parish')
    and (
      app_private.current_user_has_role(array['super_admin'])
      or app_private.current_user_can_access_country(entity_row.country_iso2)
    )
  union all
  select case
           when level_row.level_key ilike '%vicari%' or level_row.name ilike '%vicar%' then 'vicariate'
           when level_row.level_key ilike '%zona%' or level_row.level_key ilike '%zone%'
             or level_row.name ilike '%zona%' or level_row.name ilike '%zone%' then 'zone'
           else 'entity'
         end::text,
         node_row.id,node_row.name::text,
         concat_ws(' · ',template_row.name,level_row.name)::text,
         'structure_nodes'::text,node_row.diocese_id,node_row.parent_node_id
  from public.structure_nodes node_row
  join public.structure_levels level_row on level_row.id=node_row.level_id
  join public.structure_templates template_row on template_row.id=node_row.template_id
  where node_row.status='active' and node_row.is_current=true and template_row.status='active'
    and (
      v_requested is null
      or (v_requested='vicariate' and (level_row.level_key ilike '%vicari%' or level_row.name ilike '%vicar%'))
      or (v_requested='zone' and (level_row.level_key ilike '%zona%' or level_row.level_key ilike '%zone%'
          or level_row.name ilike '%zona%' or level_row.name ilike '%zone%'))
      or (v_requested='entity' and not (
          level_row.level_key ilike '%vicari%' or level_row.name ilike '%vicar%'
          or level_row.level_key ilike '%zona%' or level_row.level_key ilike '%zone%'
          or level_row.name ilike '%zona%' or level_row.name ilike '%zone%'
      ))
    )
    and (
      app_private.current_user_has_role(array['super_admin'])
      or app_private.current_user_can_access_country(
        app_private.resolve_scope_country_iso2(
          'entity',node_row.linked_ecclesiastical_entity_id,node_row.diocese_id,
          null,node_row.linked_organization_unit_id,node_row.id
        )
      )
    )
  union all
  select 'entity'::text,entity_row.id,entity_row.name::text,
         coalesce(type_row.name,type_row.key,'Entidad eclesial')::text,
         'ecclesiastical_entities'::text,
         app_private.resolve_entity_diocese_id(entity_row.id),null::uuid
  from public.ecclesiastical_entities entity_row
  join public.entity_types type_row on type_row.id=entity_row.entity_type_id
  where (v_requested is null or v_requested='entity')
    and entity_row.status='active'
    and type_row.key not in ('country','archdiocese','diocese','military_ordinariate','apostolic_vicariate','apostolic_prefecture','parish','quasi_parish')
    and (
      app_private.current_user_has_role(array['super_admin'])
      or app_private.current_user_can_access_country(entity_row.country_iso2)
    )
  union all
  select distinct 'pastoral_area'::text,area_row.id,area_row.name::text,
         coalesce(area_row.description,'Área pastoral')::text,
         'pastoral_areas'::text,null::uuid,null::uuid
  from public.pastoral_areas area_row
  join public.organization_units unit_row on unit_row.pastoral_area_id=area_row.id
  where (v_requested is null or v_requested='pastoral_area')
    and area_row.status='active'
    and unit_row.status not in ('deleted','archived')
    and (
      app_private.current_user_has_role(array['super_admin'])
      or app_private.current_user_can_access_country(
        app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id)
      )
    )
  union all
  select 'organization_unit'::text,unit_row.id,unit_row.name::text,
         coalesce(chart_row.name,'Unidad organizativa')::text,
         'organization_units'::text,
         app_private.resolve_entity_diocese_id(unit_row.ecclesiastical_entity_id),
         unit_row.parent_unit_id
  from public.organization_units unit_row
  join public.organization_charts chart_row on chart_row.id=unit_row.organization_chart_id
  where (v_requested is null or v_requested='organization_unit')
    and unit_row.status='active' and unit_row.is_current=true
    and (
      app_private.current_user_has_role(array['super_admin'])
      or app_private.current_user_can_access_country(
        app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id)
      )
    )
  order by 1,3;
end;
$$;

create or replace function app_private.validate_admin_role_scope(payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_role_id uuid := nullif(payload->>'role_id','')::uuid;
  v_requested_role_key text := nullif(payload->>'role_key','');
  v_role_key text;
  v_role_name text;
  v_scope_type text := app_private.normalize_authorization_scope_type(
    coalesce(nullif(payload->>'scope_type',''),'national')
  );
  v_selected_scope_id uuid := nullif(payload->>'scope_entity_id','')::uuid;
  v_scope_label text;
  v_source_table text;
  v_scope_entity_id uuid;
  v_structure_node_id uuid;
  v_diocese_id uuid;
  v_pastoral_area_id uuid;
  v_organization_unit_id uuid;
  v_country_iso2 char(2);
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('users.assign_roles')
    or app_private.current_user_has_role(array['super_admin'])
  ) then
    raise exception 'No autorizado para validar asignaciones de acceso' using errcode='42501';
  end if;
  if v_role_id is null and v_requested_role_key is null then
    raise exception 'Debes seleccionar un rol' using errcode='22023';
  end if;

  select role_row.id,role_row.key,role_row.name
  into v_role_id,v_role_key,v_role_name
  from public.roles role_row
  where role_row.id=v_role_id or role_row.key=v_requested_role_key
  limit 1;
  if not found then raise exception 'Rol no encontrado' using errcode='22023'; end if;
  if v_scope_type is null or v_scope_type in ('person','unknown') then
    raise exception 'Alcance de rol no permitido' using errcode='22023';
  end if;

  if v_role_key='super_admin' then
    if not app_private.current_user_has_role(array['super_admin']) then
      raise exception 'Solo un superadministrador puede asignar el rol super_admin' using errcode='42501';
    end if;
    v_scope_type := 'global';
    v_scope_label := 'Global técnico';
  elsif v_scope_type='global' then
    raise exception 'Solo el rol super_admin puede tener alcance global' using errcode='42501';
  else
    if v_selected_scope_id is null then
      raise exception 'Debes seleccionar el ámbito concreto del rol' using errcode='22023';
    end if;

    select option_row.label,option_row.source_table,option_row.diocese_id
    into v_scope_label,v_source_table,v_diocese_id
    from app_private.admin_list_role_scope_options(v_scope_type) option_row
    where option_row.scope_entity_id=v_selected_scope_id
    limit 1;
    if not found then
      raise exception 'La entidad seleccionada no está disponible dentro de tu alcance' using errcode='42501';
    end if;

    if v_scope_type in ('national','diocese','parish')
       or (v_scope_type='entity' and v_source_table='ecclesiastical_entities') then
      v_scope_entity_id := v_selected_scope_id;
      v_diocese_id := case
        when v_scope_type='diocese' then v_selected_scope_id
        else coalesce(v_diocese_id,app_private.resolve_entity_diocese_id(v_selected_scope_id))
      end;
    elsif v_scope_type in ('vicariate','zone')
       or (v_scope_type='entity' and v_source_table='structure_nodes') then
      v_structure_node_id := v_selected_scope_id;
      select coalesce(node_row.linked_ecclesiastical_entity_id,node_row.diocese_id),
             coalesce(v_diocese_id,node_row.diocese_id)
      into v_scope_entity_id,v_diocese_id
      from public.structure_nodes node_row
      where node_row.id=v_structure_node_id;
    elsif v_scope_type='pastoral_area' then
      v_pastoral_area_id := v_selected_scope_id;
      v_diocese_id := null;
    elsif v_scope_type='organization_unit' then
      v_organization_unit_id := v_selected_scope_id;
      select unit_row.ecclesiastical_entity_id,
             app_private.resolve_entity_diocese_id(unit_row.ecclesiastical_entity_id),
             unit_row.pastoral_area_id
      into v_scope_entity_id,v_diocese_id,v_pastoral_area_id
      from public.organization_units unit_row
      where unit_row.id=v_organization_unit_id;
    end if;

    v_country_iso2 := app_private.resolve_scope_country_iso2(
      v_scope_type,v_scope_entity_id,v_diocese_id,v_pastoral_area_id,
      v_organization_unit_id,v_structure_node_id
    );
    if v_country_iso2 is null then
      raise exception 'No se pudo resolver el país del alcance seleccionado' using errcode='22023';
    end if;
    if not app_private.current_user_has_role(array['super_admin'])
       and not app_private.current_user_can_access_country(v_country_iso2) then
      raise exception 'El país seleccionado no está disponible dentro de tu alcance' using errcode='42501';
    end if;
  end if;

  return jsonb_build_object(
    'role_id',v_role_id,
    'role_key',v_role_key,
    'role_name',v_role_name,
    'scope_type',v_scope_type,
    'selected_scope_id',v_selected_scope_id,
    'scope_entity_id',v_scope_entity_id,
    'structure_node_id',v_structure_node_id,
    'diocese_id',v_diocese_id,
    'pastoral_area_id',v_pastoral_area_id,
    'organization_unit_id',v_organization_unit_id,
    'scope_label',v_scope_label,
    'country_iso2',v_country_iso2
  );
end;
$$;

create or replace function app_private.admin_assign_user_role(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_user_id uuid := nullif(payload->>'user_id','')::uuid;
  v_validated jsonb;
  v_role_id uuid;
  v_role_key text;
  v_scope_type text;
  v_scope_entity_id uuid;
  v_structure_node_id uuid;
  v_diocese_id uuid;
  v_pastoral_area_id uuid;
  v_organization_unit_id uuid;
  v_country_iso2 char(2);
  v_starts_at date := coalesce(nullif(payload->>'starts_at','')::date,current_date);
  v_ends_at date := nullif(payload->>'ends_at','')::date;
  v_assignment_id uuid;
begin
  if v_actor_id is null or not (
    app_private.current_user_has_permission('users.assign_roles')
    or app_private.current_user_has_role(array['super_admin'])
  ) then
    raise exception 'No autorizado para asignar roles' using errcode='42501';
  end if;
  if v_user_id is null then raise exception 'Debes seleccionar un usuario' using errcode='22023'; end if;
  if v_ends_at is not null and v_ends_at<v_starts_at then
    raise exception 'La fecha final no puede ser menor que la fecha inicial' using errcode='22023';
  end if;
  if not app_private.current_user_can_manage_user(v_user_id)
     and not app_private.current_user_has_role(array['super_admin']) then
    raise exception 'El usuario seleccionado está fuera de tu alcance' using errcode='42501';
  end if;

  v_validated := app_private.validate_admin_role_scope(payload);
  v_role_id := nullif(v_validated->>'role_id','')::uuid;
  v_role_key := v_validated->>'role_key';
  v_scope_type := v_validated->>'scope_type';
  v_scope_entity_id := nullif(v_validated->>'scope_entity_id','')::uuid;
  v_structure_node_id := nullif(v_validated->>'structure_node_id','')::uuid;
  v_diocese_id := nullif(v_validated->>'diocese_id','')::uuid;
  v_pastoral_area_id := nullif(v_validated->>'pastoral_area_id','')::uuid;
  v_organization_unit_id := nullif(v_validated->>'organization_unit_id','')::uuid;
  v_country_iso2 := nullif(v_validated->>'country_iso2','')::char(2);

  insert into public.profiles(id,email,full_name,status)
  select auth_user.id,coalesce(auth_user.email,''),
         coalesce(nullif(btrim(auth_user.raw_user_meta_data->>'full_name'),''),
                  nullif(btrim(auth_user.email),''),'Usuario SINEP'),'active'
  from auth.users auth_user where auth_user.id=v_user_id
  on conflict(id) do update set updated_at=now();
  if not found and not exists(select 1 from auth.users where id=v_user_id) then
    raise exception 'Usuario no encontrado en Supabase Auth' using errcode='22023';
  end if;

  select assignment.id into v_assignment_id
  from public.user_role_assignments assignment
  where assignment.user_id=v_user_id
    and assignment.role_id=v_role_id
    and assignment.status='active'
    and assignment.scope_type=v_scope_type
    and assignment.scope_entity_id is not distinct from v_scope_entity_id
    and assignment.structure_node_id is not distinct from v_structure_node_id
    and assignment.country_iso2 is not distinct from v_country_iso2
    and assignment.diocese_id is not distinct from v_diocese_id
    and assignment.pastoral_area_id is not distinct from v_pastoral_area_id
    and assignment.organization_unit_id is not distinct from v_organization_unit_id
    and assignment.starts_at<=current_date
    and (assignment.ends_at is null or assignment.ends_at>=current_date)
  limit 1;

  if v_assignment_id is null then
    insert into public.user_role_assignments(
      user_id,role_id,scope_type,scope_entity_id,structure_node_id,country_iso2,
      diocese_id,pastoral_area_id,organization_unit_id,starts_at,ends_at,status,created_by
    ) values (
      v_user_id,v_role_id,v_scope_type,v_scope_entity_id,v_structure_node_id,v_country_iso2,
      v_diocese_id,v_pastoral_area_id,v_organization_unit_id,v_starts_at,v_ends_at,'active',v_actor_id
    ) returning id into v_assignment_id;
  end if;

  insert into public.audit_logs(
    user_id,action,target_table,target_id,new_data,country_iso2,
    scope_type,scope_entity_id,diocese_id,pastoral_area_id,organization_unit_id
  ) values (
    v_actor_id,'admin_assign_user_role','user_role_assignments',v_assignment_id,
    jsonb_build_object(
      'target_user_id',v_user_id,'role_id',v_role_id,'role_key',v_role_key,
      'scope_type',v_scope_type,'scope_entity_id',v_scope_entity_id,
      'structure_node_id',v_structure_node_id,'country_iso2',v_country_iso2,
      'diocese_id',v_diocese_id,'pastoral_area_id',v_pastoral_area_id,
      'organization_unit_id',v_organization_unit_id
    ),
    v_country_iso2,v_scope_type,v_scope_entity_id,v_diocese_id,
    v_pastoral_area_id,v_organization_unit_id
  );

  return jsonb_build_object(
    'assignment_id',v_assignment_id,'user_id',v_user_id,'role_id',v_role_id,
    'role_key',v_role_key,'scope_type',v_scope_type,
    'scope_entity_id',v_scope_entity_id,'structure_node_id',v_structure_node_id,
    'country_iso2',v_country_iso2,'diocese_id',v_diocese_id,
    'pastoral_area_id',v_pastoral_area_id,'organization_unit_id',v_organization_unit_id
  );
end;
$$;

create or replace function app_private.admin_get_person_detail(p_person_id uuid)
returns table(
  person_id uuid,display_name text,person_type text,status text,visibility text,
  birth_date date,birth_place text,death_date date,photo_url text,biography_public text,
  current_entity_id uuid,current_entity_name text,current_organization_unit_id uuid,
  current_organization_unit_name text,incardination_entity_id uuid,
  incardination_entity_name text,priest_type text,deacon_type text,canonical_status text,
  religious_institute_name text,can_update_proposal boolean,can_approve boolean
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog','public','app_private','auth','pg_temp'
as $$
begin
  if auth.uid() is null or not app_private.current_user_has_permission('people.view') then
    raise exception 'No autorizado para consultar personas' using errcode='42501';
  end if;
  if not app_private.current_user_can_manage_person('people.view',p_person_id) then
    return;
  end if;

  return query
  with current_assignment as (
    select distinct on (appointment.person_id)
      appointment.person_id,appointment.entity_id,appointment.organization_unit_id
    from public.appointments appointment
    where appointment.person_id=p_person_id
      and appointment.status='active' and appointment.is_current=true
      and (appointment.visibility is null or appointment.visibility<>'private')
    order by appointment.person_id,appointment.start_date desc nulls last,appointment.created_at desc
  )
  select person_row.id,
         coalesce(nullif(person_row.display_name,''),
           btrim(concat_ws(' ',person_row.first_name,person_row.middle_name,
             person_row.last_name,person_row.second_last_name))),
         person_row.person_type,person_row.status,person_row.visibility,
         person_row.birth_date,person_row.birth_place,person_row.death_date,
         person_row.photo_url,person_row.biography_public,
         coalesce(current_assignment.entity_id,clergy.current_service_entity_id,clergy.religious_house_entity_id),
         current_entity.name,current_assignment.organization_unit_id,current_unit.name,
         clergy.incardination_entity_id,incardination.name,clergy.priest_type,
         clergy.deacon_type,clergy.canonical_status,clergy.religious_institute_name,
         app_private.current_user_can_manage_person('people.update_proposal',person_row.id),
         app_private.current_user_can_manage_person('people.approve',person_row.id)
  from public.persons person_row
  left join public.clergy_profiles clergy on clergy.person_id=person_row.id
  left join current_assignment on current_assignment.person_id=person_row.id
  left join public.ecclesiastical_entities current_entity
    on current_entity.id=coalesce(current_assignment.entity_id,clergy.current_service_entity_id,clergy.religious_house_entity_id)
  left join public.organization_units current_unit on current_unit.id=current_assignment.organization_unit_id
  left join public.ecclesiastical_entities incardination on incardination.id=clergy.incardination_entity_id
  where person_row.id=p_person_id
    and (person_row.status is null or person_row.status not in ('deleted','archived'))
    and (person_row.visibility is null or person_row.visibility<>'private');
end;
$$;

create or replace function app_private.admin_get_change_request_detail(p_change_request_id uuid)
returns table(
  id uuid,target_table text,target_id uuid,action_type text,title text,description text,
  original_data jsonb,proposed_data jsonb,status text,scope_type text,scope_entity_id uuid,
  diocese_id uuid,pastoral_area_id uuid,organization_unit_id uuid,
  submitted_by_name text,submitted_by_email text,submitted_at timestamptz,
  created_at timestamptz,can_review boolean
)
language plpgsql
stable
security definer
set search_path = 'pg_catalog','public','app_private','auth','pg_temp'
as $$
begin
  if auth.uid() is null or not app_private.current_user_has_permission('change_requests.view') then
    raise exception 'No autorizado para consultar solicitudes' using errcode='42501';
  end if;

  return query
  select request_row.id,request_row.target_table,request_row.target_id,
         request_row.action_type,request_row.title,request_row.description,
         request_row.original_data,request_row.proposed_data,request_row.status,
         request_row.scope_type,request_row.scope_entity_id,request_row.diocese_id,
         request_row.pastoral_area_id,request_row.organization_unit_id,
         profile_row.full_name,profile_row.email,request_row.submitted_at,
         request_row.created_at,
         case when request_row.target_table='persons'
           then app_private.current_user_can_manage_person('people.approve',request_row.target_id)
           else app_private.current_user_can_manage_change_request('change_requests.approve',request_row.id)
         end
  from public.change_requests request_row
  left join public.profiles profile_row on profile_row.id=request_row.submitted_by
  where request_row.id=p_change_request_id
    and (
      request_row.submitted_by=auth.uid()
      or app_private.current_user_can_manage_change_request('change_requests.view',request_row.id)
    )
  limit 1;
end;
$$;

create or replace function app_private.rpc_definer__editor_suggest_office_configuration(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog','public','internal','app_private','auth','pg_temp'
as $$
declare
  v_scope_type text := app_private.normalize_authorization_scope_type(
    coalesce(nullif(payload->>'scope_type',''),'entity')
  );
  v_scope_entity_id uuid := app_private.audit_json_uuid(payload,'scope_entity_id');
  v_diocese_id uuid := app_private.audit_json_uuid(payload,'diocese_id');
  v_pastoral_area_id uuid := app_private.audit_json_uuid(payload,'pastoral_area_id');
  v_organization_unit_id uuid := app_private.audit_json_uuid(payload,'organization_unit_id');
  v_structure_node_id uuid := app_private.audit_json_uuid(payload,'structure_node_id');
  v_permission_key text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode='42501';
  end if;

  v_permission_key := case
    when app_private.current_user_has_permission('structures.manage') then 'structures.manage'
    when app_private.current_user_has_permission('pastorals.create_proposal') then 'pastorals.create_proposal'
    when app_private.current_user_has_permission('entities.create_proposal') then 'entities.create_proposal'
    else null
  end;
  if v_permission_key is null then
    raise exception 'No autorizado para sugerir cargos' using errcode='42501';
  end if;

  if not app_private.current_user_can_manage_scope(
    v_permission_key,v_scope_type,v_scope_entity_id,v_diocese_id,
    v_pastoral_area_id,v_organization_unit_id,v_structure_node_id
  ) then
    raise exception 'El alcance de la sugerencia está fuera de tu jurisdicción' using errcode='42501';
  end if;

  return internal.editor_suggest_office_configuration(payload);
end;
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

revoke all on function app_private.current_user_can_manage_scope(text,text,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function app_private.current_user_can_manage_change_request(text,uuid) from public,anon,authenticated;
revoke all on function app_private.current_user_can(text,text,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function app_private.current_user_has_scope_access(text,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.current_user_has_scope_access(text,uuid,uuid,uuid,uuid) from anon,authenticated;

grant execute on function app_private.admin_list_role_scope_options(text) to authenticated;
grant execute on function app_private.validate_admin_role_scope(jsonb) to authenticated;
grant execute on function app_private.admin_assign_user_role(jsonb) to authenticated;
grant execute on function app_private.admin_get_person_detail(uuid) to authenticated;

comment on function app_private.current_user_can_manage_scope(text,text,uuid,uuid,uuid,uuid,uuid)
is 'Despachador tipado de autorización por país, entidad, nodo, área, unidad o persona.';
comment on function app_private.current_user_has_scope_access(text,uuid,uuid,uuid,uuid)
is 'Compatibilidad privada y country-aware. No usar en nuevas fronteras; preferir current_user_can_manage_scope con permiso explícito.';
comment on function public.current_user_has_scope_access(text,uuid,uuid,uuid,uuid)
is 'Fachada heredada retirada para clientes. Las fronteras nuevas usan helpers tipados con permiso explícito.';