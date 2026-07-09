-- Harden admin access helpers and version RPCs used by the admin UI.

drop function if exists public.admin_assign_user_role(jsonb);
drop function if exists public.admin_end_user_role(jsonb);
drop function if exists public.admin_update_user_profile_status(jsonb);
drop function if exists public.admin_list_users();
drop function if exists public.admin_list_roles_with_permissions();
drop function if exists public.admin_list_role_scope_options(text);
drop function if exists public.get_structure_templates(uuid, text, boolean);
drop function if exists public.get_structure_tree(uuid, uuid, date, boolean);
drop function if exists public.get_structure_child_level_options(uuid, uuid);
drop function if exists public.admin_save_structure_template(jsonb);
drop function if exists public.admin_save_structure_level(jsonb);
drop function if exists public.admin_save_structure_node(jsonb);

create or replace function public.current_user_has_admin_role()
returns boolean
language sql
security definer
set search_path = public, auth, pg_temp
stable
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and (ura.ends_at is null or ura.ends_at >= now())
      and r.key in (
        'super_admin',
        'national_admin',
        'diocesan_admin',
        'diocesan_editor',
        'vicariate_editor',
        'zone_editor',
        'parish_editor',
        'pastoral_editor'
      )
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public, auth, pg_temp
stable
as $$
  select public.current_user_has_admin_role();
$$;

create or replace function public.current_user_is_super_or_national()
returns boolean
language sql
security definer
set search_path = public, auth, pg_temp
stable
as $$
  select exists (
    select 1
    from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and (ura.ends_at is null or ura.ends_at >= now())
      and r.key in ('super_admin', 'national_admin')
  );
$$;

create or replace function public.current_user_has_permission(p_permission_key text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
stable
as $$
declare
  v_user_id uuid := auth.uid();
  v_has_permission boolean := false;
begin
  if v_user_id is null or nullif(btrim(p_permission_key), '') is null then
    return false;
  end if;

  if public.current_user_is_super_or_national() then
    return true;
  end if;

  if to_regclass('public.permissions') is null
    or to_regclass('public.role_permissions') is null then
    return false;
  end if;

  select exists (
    select 1
    from public.user_role_assignments ura
    join public.role_permissions rp on rp.role_id = ura.role_id
    join public.permissions p on p.id = rp.permission_id
    where ura.user_id = v_user_id
      and ura.status = 'active'
      and (ura.ends_at is null or ura.ends_at >= now())
      and p.key = p_permission_key
  )
  into v_has_permission;

  return coalesce(v_has_permission, false);
end;
$$;

create or replace function public.admin_assign_user_role(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_assignment_id uuid;
  v_user_id uuid := nullif(payload->>'user_id', '')::uuid;
  v_role_id uuid := nullif(payload->>'role_id', '')::uuid;
  v_role_key text := nullif(btrim(payload->>'role_key'), '');
  v_scope_type text := coalesce(nullif(btrim(payload->>'scope_type'), ''), 'national');
  v_scope_entity_id uuid := nullif(payload->>'scope_entity_id', '')::uuid;
  v_starts_at timestamptz := coalesce(nullif(payload->>'starts_at', '')::timestamptz, now());
  v_ends_at timestamptz := nullif(payload->>'ends_at', '')::timestamptz;
begin
  if v_actor_id is null
    or (
      not public.current_user_has_permission('users.manage')
      and not public.current_user_is_super_or_national()
    ) then
    raise exception 'No autorizado para asignar roles' using errcode = '42501';
  end if;

  if v_user_id is null then
    raise exception 'Falta el usuario' using errcode = '22023';
  end if;

  if v_role_id is null and v_role_key is not null then
    select id into v_role_id
    from public.roles
    where key = v_role_key;
  end if;

  if v_role_id is null then
    raise exception 'Falta el rol' using errcode = '22023';
  end if;

  if v_scope_type not in (
    'national',
    'global',
    'diocese',
    'vicariate',
    'zone',
    'parish',
    'pastoral_area',
    'pastoral_entity',
    'entity'
  ) then
    raise exception 'Tipo de alcance no permitido' using errcode = '22023';
  end if;

  if v_scope_type not in ('national', 'global') and v_scope_entity_id is null then
    raise exception 'Falta la entidad del alcance' using errcode = '22023';
  end if;

  insert into public.user_role_assignments (
    user_id,
    role_id,
    scope_type,
    scope_entity_id,
    starts_at,
    ends_at,
    status
  ) values (
    v_user_id,
    v_role_id,
    v_scope_type,
    v_scope_entity_id,
    v_starts_at,
    v_ends_at,
    'active'
  )
  returning id into v_assignment_id;

  return jsonb_build_object('assignment_id', v_assignment_id);
end;
$$;

create or replace function public.admin_end_user_role(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_assignment_id uuid := nullif(payload->>'assignment_id', '')::uuid;
  v_end_at timestamptz := coalesce(nullif(payload->>'ends_at', '')::timestamptz, now());
begin
  if v_actor_id is null
    or (
      not public.current_user_has_permission('users.manage')
      and not public.current_user_is_super_or_national()
    ) then
    raise exception 'No autorizado para cerrar roles' using errcode = '42501';
  end if;

  if v_assignment_id is null then
    raise exception 'Falta la asignacion de rol' using errcode = '22023';
  end if;

  update public.user_role_assignments
  set status = 'ended',
      ends_at = v_end_at
  where id = v_assignment_id
  returning id into v_assignment_id;

  if v_assignment_id is null then
    raise exception 'Asignacion de rol no encontrada' using errcode = '22023';
  end if;

  return jsonb_build_object('assignment_id', v_assignment_id, 'ended_at', v_end_at);
end;
$$;

create or replace function public.admin_update_user_profile_status(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_user_id uuid := nullif(payload->>'user_id', '')::uuid;
  v_status text := nullif(btrim(payload->>'status'), '');
begin
  if v_actor_id is null
    or (
      not public.current_user_has_permission('users.manage')
      and not public.current_user_is_super_or_national()
    ) then
    raise exception 'No autorizado para actualizar usuarios' using errcode = '42501';
  end if;

  if v_user_id is null or v_status is null then
    raise exception 'Faltan datos del usuario' using errcode = '22023';
  end if;

  if v_status not in ('pending', 'active', 'suspended', 'disabled') then
    raise exception 'Estado de usuario no permitido' using errcode = '22023';
  end if;

  insert into public.profiles (id, status)
  values (v_user_id, v_status)
  on conflict (id) do update
  set status = excluded.status;

  return jsonb_build_object('user_id', v_user_id, 'status', v_status);
end;
$$;

create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  profile_status text,
  auth_created_at timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  active_roles jsonb,
  active_permissions jsonb
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
stable
as $$
begin
  if auth.uid() is null
    or (
      not public.current_user_has_permission('users.manage')
      and not public.current_user_is_super_or_national()
    ) then
    raise exception 'No autorizado para listar usuarios' using errcode = '42501';
  end if;

  return query
  select
    u.id as user_id,
    u.email::text,
    pr.full_name::text,
    pr.phone::text,
    coalesce(pr.status::text, 'pending') as profile_status,
    u.created_at as auth_created_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'assignment_id', ura.id,
            'role_id', r.id,
            'role_key', r.key,
            'role_name', r.name,
            'scope_type', ura.scope_type,
            'scope_entity_id', ura.scope_entity_id,
            'diocese_id', case when ura.scope_type = 'diocese' then ura.scope_entity_id else null end,
            'pastoral_area_id', case when ura.scope_type = 'pastoral_area' then ura.scope_entity_id else null end,
            'pastoral_entity_id', case when ura.scope_type = 'pastoral_entity' then ura.scope_entity_id else null end,
            'starts_at', ura.starts_at,
            'ends_at', ura.ends_at,
            'status', ura.status
          )
          order by r.name
        )
        from public.user_role_assignments ura
        join public.roles r on r.id = ura.role_id
        where ura.user_id = u.id
          and ura.status = 'active'
          and (ura.ends_at is null or ura.ends_at >= now())
      ),
      '[]'::jsonb
    ) as active_roles,
    coalesce(
      (
        select jsonb_agg(to_jsonb(permission_row) order by permission_row.key)
        from (
          select distinct
            p.key::text,
            p.module::text,
            p.description::text
          from public.user_role_assignments ura
          join public.role_permissions rp on rp.role_id = ura.role_id
          join public.permissions p on p.id = rp.permission_id
          where ura.user_id = u.id
            and ura.status = 'active'
            and (ura.ends_at is null or ura.ends_at >= now())
        ) permission_row
      ),
      '[]'::jsonb
    ) as active_permissions
  from auth.users u
  left join public.profiles pr on pr.id = u.id
  order by u.created_at desc;
end;
$$;

create or replace function public.admin_list_roles_with_permissions()
returns table (
  role_id uuid,
  role_key text,
  role_name text,
  description text,
  is_system_role boolean,
  active_assignments_count bigint,
  permissions jsonb
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
stable
as $$
begin
  if auth.uid() is null
    or (
      not public.current_user_has_permission('users.manage')
      and not public.current_user_is_super_or_national()
    ) then
    raise exception 'No autorizado para listar roles' using errcode = '42501';
  end if;

  return query
  select
    r.id as role_id,
    r.key::text as role_key,
    r.name::text as role_name,
    r.description::text,
    coalesce(r.is_system_role, false) as is_system_role,
    (
      select count(*)
      from public.user_role_assignments ura
      where ura.role_id = r.id
        and ura.status = 'active'
        and (ura.ends_at is null or ura.ends_at >= now())
    ) as active_assignments_count,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'key', p.key,
            'module', p.module,
            'description', p.description
          )
          order by p.key
        )
        from public.role_permissions rp
        join public.permissions p on p.id = rp.permission_id
        where rp.role_id = r.id
      ),
      '[]'::jsonb
    ) as permissions
  from public.roles r
  order by r.name;
end;
$$;

create or replace function public.admin_list_role_scope_options(p_scope_type text default null)
returns table (
  scope_type text,
  scope_entity_id uuid,
  label text,
  description text,
  source_table text,
  diocese_id uuid,
  parent_id uuid
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
stable
as $$
begin
  if auth.uid() is null
    or (
      not public.current_user_has_permission('users.manage')
      and not public.current_user_is_super_or_national()
    ) then
    raise exception 'No autorizado para listar alcances' using errcode = '42501';
  end if;

  return query
  select
    case
      when et.key in ('diocese', 'archdiocese', 'military_ordinariate') then 'diocese'
      when et.key in ('vicariate', 'vicarial_zone') then 'vicariate'
      when et.key in ('pastoral_zone', 'zone') then 'zone'
      when et.key = 'parish' then 'parish'
      else 'entity'
    end::text as scope_type,
    e.id as scope_entity_id,
    e.name::text as label,
    coalesce(e.official_name, e.description)::text as description,
    'ecclesiastical_entities'::text as source_table,
    case
      when et.key in ('diocese', 'archdiocese', 'military_ordinariate') then e.id
      else null
    end as diocese_id,
    null::uuid as parent_id
  from public.ecclesiastical_entities e
  join public.entity_types et on et.id = e.entity_type_id
  where coalesce(e.status::text, 'active') = 'active'
    and (
      p_scope_type is null
      or p_scope_type = case
        when et.key in ('diocese', 'archdiocese', 'military_ordinariate') then 'diocese'
        when et.key in ('vicariate', 'vicarial_zone') then 'vicariate'
        when et.key in ('pastoral_zone', 'zone') then 'zone'
        when et.key = 'parish' then 'parish'
        else 'entity'
      end
    )
  order by e.name;
end;
$$;

create or replace function public.get_structure_templates(
  p_diocese_id uuid,
  p_kind_key text default null,
  p_active_only boolean default true
)
returns table (
  id uuid,
  diocese_id uuid,
  kind_key text,
  key text,
  name text,
  description text,
  is_primary boolean,
  is_active boolean,
  status text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
stable
as $$
begin
  if auth.uid() is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para listar estructuras' using errcode = '42501';
  end if;

  return query
  select
    st.id,
    st.diocese_id,
    st.kind_key::text,
    st.key::text,
    st.name::text,
    st.description::text,
    coalesce(st.is_primary, false),
    coalesce(st.is_active, true),
    coalesce(st.status::text, 'active')
  from public.structure_templates st
  where st.diocese_id = p_diocese_id
    and (p_kind_key is null or st.kind_key = p_kind_key)
    and (
      not p_active_only
      or (coalesce(st.is_active, true) and coalesce(st.status::text, 'active') = 'active')
    )
  order by coalesce(st.is_primary, false) desc, st.name;
end;
$$;

create or replace function public.get_structure_tree(
  p_template_id uuid,
  p_root_node_id uuid default null,
  p_as_of date default current_date,
  p_include_inactive boolean default false
)
returns table (
  node_id uuid,
  template_id uuid,
  level_id uuid,
  level_key text,
  level_name text,
  parent_node_id uuid,
  depth integer,
  path_ids uuid[],
  path_names text[],
  name text,
  official_name text,
  slug text,
  code text,
  linked_ecclesiastical_entity_id uuid,
  linked_pastoral_entity_id uuid,
  start_date date,
  end_date date,
  is_current boolean,
  status text,
  visibility text,
  has_children boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
stable
as $$
begin
  if auth.uid() is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para listar arboles de estructura' using errcode = '42501';
  end if;

  return query
  with recursive tree as (
    select
      sn.id as node_id,
      sn.template_id,
      sn.level_id,
      sl.level_key::text,
      sl.name::text as level_name,
      sn.parent_node_id,
      0::integer as depth,
      array[sn.id]::uuid[] as path_ids,
      array[sn.name::text]::text[] as path_names,
      sn.name::text,
      sn.official_name::text,
      sn.slug::text,
      sn.code::text,
      sn.linked_ecclesiastical_entity_id,
      sn.linked_pastoral_entity_id,
      sn.start_date,
      sn.end_date,
      coalesce(sn.is_current, true) as is_current,
      coalesce(sn.status::text, 'active') as status,
      coalesce(sn.visibility::text, 'public') as visibility
    from public.structure_nodes sn
    join public.structure_levels sl on sl.id = sn.level_id
    where sn.template_id = p_template_id
      and (
        (p_root_node_id is null and sn.parent_node_id is null)
        or sn.id = p_root_node_id
      )
      and (
        p_include_inactive
        or (
          coalesce(sn.status::text, 'active') = 'active'
          and coalesce(sn.is_current, true)
          and (sn.start_date is null or p_as_of is null or sn.start_date <= p_as_of)
          and (sn.end_date is null or p_as_of is null or sn.end_date >= p_as_of)
        )
      )

    union all

    select
      child.id as node_id,
      child.template_id,
      child.level_id,
      child_level.level_key::text,
      child_level.name::text as level_name,
      child.parent_node_id,
      tree.depth + 1,
      tree.path_ids || child.id,
      tree.path_names || child.name::text,
      child.name::text,
      child.official_name::text,
      child.slug::text,
      child.code::text,
      child.linked_ecclesiastical_entity_id,
      child.linked_pastoral_entity_id,
      child.start_date,
      child.end_date,
      coalesce(child.is_current, true),
      coalesce(child.status::text, 'active'),
      coalesce(child.visibility::text, 'public')
    from public.structure_nodes child
    join public.structure_levels child_level on child_level.id = child.level_id
    join tree on tree.node_id = child.parent_node_id
    where child.template_id = p_template_id
      and not child.id = any(tree.path_ids)
      and (
        p_include_inactive
        or (
          coalesce(child.status::text, 'active') = 'active'
          and coalesce(child.is_current, true)
          and (child.start_date is null or p_as_of is null or child.start_date <= p_as_of)
          and (child.end_date is null or p_as_of is null or child.end_date >= p_as_of)
        )
      )
  )
  select
    tree.node_id,
    tree.template_id,
    tree.level_id,
    tree.level_key,
    tree.level_name,
    tree.parent_node_id,
    tree.depth,
    tree.path_ids,
    tree.path_names,
    tree.name,
    tree.official_name,
    tree.slug,
    tree.code,
    tree.linked_ecclesiastical_entity_id,
    tree.linked_pastoral_entity_id,
    tree.start_date,
    tree.end_date,
    tree.is_current,
    tree.status,
    tree.visibility,
    exists (
      select 1
      from public.structure_nodes child
      where child.parent_node_id = tree.node_id
        and child.template_id = p_template_id
    ) as has_children
  from tree
  order by tree.path_names;
end;
$$;

create or replace function public.get_structure_child_level_options(
  p_template_id uuid,
  p_parent_level_id uuid default null
)
returns table (
  level_id uuid,
  level_key text,
  level_name text,
  plural_name text,
  level_order integer,
  parent_level_id uuid,
  edge_id uuid,
  allows_multiple boolean,
  is_required boolean
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
stable
as $$
begin
  if auth.uid() is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para listar niveles hijos' using errcode = '42501';
  end if;

  return query
  select
    sl.id as level_id,
    sl.level_key::text,
    sl.name::text as level_name,
    sl.plural_name::text,
    sl.level_order,
    sl.parent_level_id,
    null::uuid as edge_id,
    coalesce(sl.allows_multiple_entities, true) as allows_multiple,
    coalesce(sl.is_required, false) as is_required
  from public.structure_levels sl
  where sl.template_id = p_template_id
    and sl.parent_level_id is not distinct from p_parent_level_id
    and coalesce(sl.status::text, 'active') = 'active'
  order by sl.level_order, sl.name;
end;
$$;

create or replace function public.admin_save_structure_template(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_template_id uuid := nullif(payload->>'id', '')::uuid;
  v_diocese_id uuid := nullif(payload->>'diocese_id', '')::uuid;
  v_kind_key text := coalesce(nullif(btrim(payload->>'kind_key'), ''), 'territorial');
  v_key text := nullif(btrim(payload->>'key'), '');
  v_name text := nullif(btrim(payload->>'name'), '');
  v_is_primary boolean := coalesce((payload->>'is_primary')::boolean, false);
  v_is_active boolean := coalesce((payload->>'is_active')::boolean, true);
  v_status text := coalesce(nullif(btrim(payload->>'status'), ''), 'active');
begin
  if auth.uid() is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar plantillas de estructura' using errcode = '42501';
  end if;

  if v_diocese_id is null or v_name is null then
    raise exception 'Faltan datos de la plantilla' using errcode = '22023';
  end if;

  if v_key is null then
    v_key := lower(regexp_replace(v_kind_key || '-' || v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  end if;

  if v_is_primary then
    update public.structure_templates
    set is_primary = false
    where diocese_id = v_diocese_id
      and kind_key = v_kind_key
      and (v_template_id is null or id <> v_template_id);
  end if;

  if v_template_id is not null then
    update public.structure_templates
    set kind_key = v_kind_key,
        key = v_key,
        name = v_name,
        description = nullif(btrim(payload->>'description'), ''),
        is_primary = v_is_primary,
        is_active = v_is_active,
        status = v_status
    where id = v_template_id
    returning id into v_template_id;
  else
    insert into public.structure_templates (
      diocese_id,
      kind_key,
      key,
      name,
      description,
      is_primary,
      is_active,
      status
    ) values (
      v_diocese_id,
      v_kind_key,
      v_key,
      v_name,
      nullif(btrim(payload->>'description'), ''),
      v_is_primary,
      v_is_active,
      v_status
    )
    returning id into v_template_id;
  end if;

  if v_template_id is null then
    raise exception 'No se pudo guardar la plantilla' using errcode = '22023';
  end if;

  return jsonb_build_object('id', v_template_id, 'success', true);
end;
$$;

create or replace function public.admin_save_structure_level(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_level_id uuid := nullif(payload->>'id', '')::uuid;
  v_template_id uuid := nullif(payload->>'template_id', '')::uuid;
  v_parent_level_id uuid := nullif(payload->>'parent_level_id', '')::uuid;
  v_linked_entity_type_id uuid := nullif(payload->>'linked_entity_type_id', '')::uuid;
  v_level_key text := nullif(btrim(payload->>'level_key'), '');
  v_name text := nullif(btrim(payload->>'name'), '');
  v_level_order integer := coalesce(nullif(payload->>'level_order', '')::integer, 1);
begin
  if auth.uid() is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar niveles de estructura' using errcode = '42501';
  end if;

  if v_template_id is null or v_name is null then
    raise exception 'Faltan datos del nivel' using errcode = '22023';
  end if;

  if v_level_key is null then
    v_level_key := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  end if;

  if v_level_id is not null and v_parent_level_id = v_level_id then
    raise exception 'Un nivel no puede ser su propio padre' using errcode = '22023';
  end if;

  if v_level_id is not null then
    update public.structure_levels
    set parent_level_id = v_parent_level_id,
        linked_entity_type_id = v_linked_entity_type_id,
        level_key = v_level_key,
        name = v_name,
        plural_name = nullif(btrim(payload->>'plural_name'), ''),
        description = nullif(btrim(payload->>'description'), ''),
        level_order = v_level_order,
        scope = coalesce(nullif(btrim(payload->>'scope'), ''), 'ecclesial'),
        is_entry_point = coalesce((payload->>'is_entry_point')::boolean, false),
        is_required = coalesce((payload->>'is_required')::boolean, false),
        allows_multiple_entities = coalesce((payload->>'allows_multiple_entities')::boolean, true),
        allows_new_nodes = coalesce((payload->>'allows_new_nodes')::boolean, true),
        status = coalesce(nullif(btrim(payload->>'status'), ''), 'active')
    where id = v_level_id
    returning id into v_level_id;
  else
    insert into public.structure_levels (
      template_id,
      parent_level_id,
      linked_entity_type_id,
      level_key,
      name,
      plural_name,
      description,
      level_order,
      scope,
      is_entry_point,
      is_required,
      allows_multiple_entities,
      allows_new_nodes,
      status
    ) values (
      v_template_id,
      v_parent_level_id,
      v_linked_entity_type_id,
      v_level_key,
      v_name,
      nullif(btrim(payload->>'plural_name'), ''),
      nullif(btrim(payload->>'description'), ''),
      v_level_order,
      coalesce(nullif(btrim(payload->>'scope'), ''), 'ecclesial'),
      coalesce((payload->>'is_entry_point')::boolean, false),
      coalesce((payload->>'is_required')::boolean, false),
      coalesce((payload->>'allows_multiple_entities')::boolean, true),
      coalesce((payload->>'allows_new_nodes')::boolean, true),
      coalesce(nullif(btrim(payload->>'status'), ''), 'active')
    )
    returning id into v_level_id;
  end if;

  if v_level_id is null then
    raise exception 'No se pudo guardar el nivel' using errcode = '22023';
  end if;

  return jsonb_build_object('id', v_level_id, 'success', true);
end;
$$;

create or replace function public.admin_save_structure_node(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_node_id uuid := nullif(payload->>'id', '')::uuid;
  v_template_id uuid := nullif(payload->>'template_id', '')::uuid;
  v_level_id uuid := nullif(payload->>'level_id', '')::uuid;
  v_parent_node_id uuid := nullif(payload->>'parent_node_id', '')::uuid;
  v_linked_ecclesiastical_entity_id uuid := nullif(payload->>'linked_ecclesiastical_entity_id', '')::uuid;
  v_linked_pastoral_entity_id uuid := nullif(payload->>'linked_pastoral_entity_id', '')::uuid;
  v_name text := nullif(btrim(payload->>'name'), '');
  v_slug text := nullif(btrim(payload->>'slug'), '');
begin
  if auth.uid() is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para guardar nodos de estructura' using errcode = '42501';
  end if;

  if v_template_id is null or v_level_id is null or v_name is null then
    raise exception 'Faltan datos del nodo' using errcode = '22023';
  end if;

  if v_slug is null then
    v_slug := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  end if;

  if v_node_id is null
    and v_parent_node_id is null
    and v_linked_ecclesiastical_entity_id is not null then
    select id into v_node_id
    from public.structure_nodes
    where template_id = v_template_id
      and level_id = v_level_id
      and parent_node_id is null
      and linked_ecclesiastical_entity_id = v_linked_ecclesiastical_entity_id
    limit 1;
  end if;

  if v_node_id is not null then
    update public.structure_nodes
    set level_id = v_level_id,
        parent_node_id = v_parent_node_id,
        name = v_name,
        official_name = nullif(btrim(payload->>'official_name'), ''),
        slug = v_slug,
        code = nullif(btrim(payload->>'code'), ''),
        description = nullif(btrim(payload->>'description'), ''),
        linked_ecclesiastical_entity_id = v_linked_ecclesiastical_entity_id,
        linked_pastoral_entity_id = v_linked_pastoral_entity_id,
        start_date = nullif(payload->>'start_date', '')::date,
        end_date = nullif(payload->>'end_date', '')::date,
        is_current = coalesce((payload->>'is_current')::boolean, true),
        status = coalesce(nullif(btrim(payload->>'status'), ''), 'active'),
        visibility = coalesce(nullif(btrim(payload->>'visibility'), ''), 'public')
    where id = v_node_id
    returning id into v_node_id;
  else
    insert into public.structure_nodes (
      template_id,
      level_id,
      parent_node_id,
      name,
      official_name,
      slug,
      code,
      description,
      linked_ecclesiastical_entity_id,
      linked_pastoral_entity_id,
      start_date,
      end_date,
      is_current,
      status,
      visibility
    ) values (
      v_template_id,
      v_level_id,
      v_parent_node_id,
      v_name,
      nullif(btrim(payload->>'official_name'), ''),
      v_slug,
      nullif(btrim(payload->>'code'), ''),
      nullif(btrim(payload->>'description'), ''),
      v_linked_ecclesiastical_entity_id,
      v_linked_pastoral_entity_id,
      nullif(payload->>'start_date', '')::date,
      nullif(payload->>'end_date', '')::date,
      coalesce((payload->>'is_current')::boolean, true),
      coalesce(nullif(btrim(payload->>'status'), ''), 'active'),
      coalesce(nullif(btrim(payload->>'visibility'), ''), 'public')
    )
    returning id into v_node_id;
  end if;

  if v_node_id is null then
    raise exception 'No se pudo guardar el nodo' using errcode = '22023';
  end if;

  return jsonb_build_object('id', v_node_id, 'node_id', v_node_id, 'success', true);
end;
$$;

revoke execute on function public.current_user_has_admin_role() from public;
revoke execute on function public.current_user_is_admin() from public;
revoke execute on function public.current_user_is_super_or_national() from public;
revoke execute on function public.current_user_has_permission(text) from public;
revoke execute on function public.admin_assign_user_role(jsonb) from public;
revoke execute on function public.admin_end_user_role(jsonb) from public;
revoke execute on function public.admin_update_user_profile_status(jsonb) from public;
revoke execute on function public.admin_list_users() from public;
revoke execute on function public.admin_list_roles_with_permissions() from public;
revoke execute on function public.admin_list_role_scope_options(text) from public;
revoke execute on function public.get_structure_templates(uuid, text, boolean) from public;
revoke execute on function public.get_structure_tree(uuid, uuid, date, boolean) from public;
revoke execute on function public.get_structure_child_level_options(uuid, uuid) from public;
revoke execute on function public.admin_save_structure_template(jsonb) from public;
revoke execute on function public.admin_save_structure_level(jsonb) from public;
revoke execute on function public.admin_save_structure_node(jsonb) from public;

revoke execute on function public.current_user_has_admin_role() from anon;
revoke execute on function public.current_user_is_admin() from anon;
revoke execute on function public.current_user_is_super_or_national() from anon;
revoke execute on function public.current_user_has_permission(text) from anon;
revoke execute on function public.admin_assign_user_role(jsonb) from anon;
revoke execute on function public.admin_end_user_role(jsonb) from anon;
revoke execute on function public.admin_update_user_profile_status(jsonb) from anon;
revoke execute on function public.admin_list_users() from anon;
revoke execute on function public.admin_list_roles_with_permissions() from anon;
revoke execute on function public.admin_list_role_scope_options(text) from anon;
revoke execute on function public.get_structure_templates(uuid, text, boolean) from anon;
revoke execute on function public.get_structure_tree(uuid, uuid, date, boolean) from anon;
revoke execute on function public.get_structure_child_level_options(uuid, uuid) from anon;
revoke execute on function public.admin_save_structure_template(jsonb) from anon;
revoke execute on function public.admin_save_structure_level(jsonb) from anon;
revoke execute on function public.admin_save_structure_node(jsonb) from anon;

grant execute on function public.current_user_has_admin_role() to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.current_user_is_super_or_national() to authenticated;
grant execute on function public.current_user_has_permission(text) to authenticated;
grant execute on function public.admin_assign_user_role(jsonb) to authenticated;
grant execute on function public.admin_end_user_role(jsonb) to authenticated;
grant execute on function public.admin_update_user_profile_status(jsonb) to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_list_roles_with_permissions() to authenticated;
grant execute on function public.admin_list_role_scope_options(text) to authenticated;
grant execute on function public.get_structure_templates(uuid, text, boolean) to authenticated;
grant execute on function public.get_structure_tree(uuid, uuid, date, boolean) to authenticated;
grant execute on function public.get_structure_child_level_options(uuid, uuid) to authenticated;
grant execute on function public.admin_save_structure_template(jsonb) to authenticated;
grant execute on function public.admin_save_structure_level(jsonb) to authenticated;
grant execute on function public.admin_save_structure_node(jsonb) to authenticated;
