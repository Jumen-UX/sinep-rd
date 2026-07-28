create or replace function app_private.normalize_authorization_scope_type(p_scope_type text)
returns text
language sql
immutable
set search_path = 'pg_catalog', 'pg_temp'
as $$
  select case lower(btrim(coalesce(p_scope_type, '')))
    when 'global' then 'global'
    when 'country' then 'national'
    when 'national' then 'national'
    when 'archdiocese' then 'diocese'
    when 'apostolic_vicariate' then 'diocese'
    when 'diocese' then 'diocese'
    when 'vicariate' then 'vicariate'
    when 'pastoral_zone' then 'zone'
    when 'zone' then 'zone'
    when 'parish' then 'parish'
    when 'quasi_parish' then 'parish'
    when 'chapel' then 'entity'
    when 'ecclesiastical_province' then 'entity'
    when 'entity' then 'entity'
    when 'pastoral_area' then 'pastoral_area'
    when 'pastoral_entity' then 'organization_unit'
    when 'organization_unit' then 'organization_unit'
    when 'person' then 'person'
    when 'unknown' then 'unknown'
    when 'other' then 'unknown'
    else null
  end;
$$;

alter table public.user_role_assignments
  add column if not exists structure_node_id uuid references public.structure_nodes(id) on delete set null;

create index if not exists user_role_assignments_structure_node_id_idx
  on public.user_role_assignments(structure_node_id);

create or replace function app_private.resolve_scope_country_iso2(
  p_scope_type text,
  p_scope_entity_id uuid,
  p_diocese_id uuid,
  p_pastoral_area_id uuid,
  p_organization_unit_id uuid,
  p_structure_node_id uuid
)
returns char(2)
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
declare
  v_scope_type text := app_private.normalize_authorization_scope_type(p_scope_type);
  v_country_iso2 char(2);
  v_country_count integer;
begin
  if v_scope_type = 'global' then
    return null;
  end if;

  if p_scope_entity_id is not null then
    v_country_iso2 := app_private.resolve_entity_country_iso2(p_scope_entity_id);
  end if;

  if v_country_iso2 is null and p_structure_node_id is not null then
    select coalesce(
      app_private.resolve_entity_country_iso2(node_row.linked_ecclesiastical_entity_id),
      app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id),
      app_private.resolve_entity_country_iso2(node_row.diocese_id)
    )
    into v_country_iso2
    from public.structure_nodes node_row
    left join public.organization_units unit_row
      on unit_row.id = node_row.linked_organization_unit_id
    where node_row.id = p_structure_node_id
    limit 1;
  end if;

  if v_country_iso2 is null and p_diocese_id is not null then
    v_country_iso2 := app_private.resolve_entity_country_iso2(p_diocese_id);
  end if;

  if v_country_iso2 is null and p_organization_unit_id is not null then
    select app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id)
    into v_country_iso2
    from public.organization_units unit_row
    where unit_row.id = p_organization_unit_id
    limit 1;
  end if;

  if v_country_iso2 is null and p_pastoral_area_id is not null then
    select count(distinct app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id)),
           min(app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id))
    into v_country_count, v_country_iso2
    from public.organization_units unit_row
    where unit_row.pastoral_area_id = p_pastoral_area_id
      and unit_row.status not in ('deleted', 'archived')
      and app_private.resolve_entity_country_iso2(unit_row.ecclesiastical_entity_id) is not null;

    if v_country_count > 1 then
      raise exception 'El área pastoral está vinculada a más de un país.' using errcode = '23514';
    end if;
  end if;

  return v_country_iso2;
end;
$$;

create or replace function app_private.resolve_scope_country_iso2(
  p_scope_type text,
  p_scope_entity_id uuid default null,
  p_diocese_id uuid default null,
  p_pastoral_area_id uuid default null,
  p_organization_unit_id uuid default null
)
returns char(2)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
  select app_private.resolve_scope_country_iso2(
    p_scope_type,
    p_scope_entity_id,
    p_diocese_id,
    p_pastoral_area_id,
    p_organization_unit_id,
    null
  );
$$;

alter table public.user_role_assignments
  drop constraint if exists user_role_assignments_scope_type_check;

update public.user_role_assignments assignment
set scope_type = case
  when role_row.key = 'super_admin' then 'global'
  else coalesce(app_private.normalize_authorization_scope_type(assignment.scope_type), 'entity')
end,
    scope_entity_id = case when role_row.key = 'super_admin' then null else assignment.scope_entity_id end,
    country_iso2 = case when role_row.key = 'super_admin' then null else assignment.country_iso2 end,
    diocese_id = case when role_row.key = 'super_admin' then null else assignment.diocese_id end,
    pastoral_area_id = case when role_row.key = 'super_admin' then null else assignment.pastoral_area_id end,
    organization_unit_id = case when role_row.key = 'super_admin' then null else assignment.organization_unit_id end,
    structure_node_id = case when role_row.key = 'super_admin' then null else assignment.structure_node_id end
from public.roles role_row
where role_row.id = assignment.role_id;

alter table public.user_role_assignments
  add constraint user_role_assignments_scope_type_check
  check (scope_type in (
    'global','national','diocese','vicariate','zone','parish',
    'pastoral_area','organization_unit','entity'
  ));

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
    or (scope_type in ('parish','entity')
      and scope_entity_id is not null
      and country_iso2 is not null
      and pastoral_area_id is null
      and organization_unit_id is null
      and structure_node_id is null)
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

create or replace function app_private.derive_role_assignment_country_context()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'pg_temp'
as $$
declare
  v_role_key text;
  v_scope_type text;
  v_derived_country_iso2 char(2);
  v_entity_id uuid;
  v_entity_type_key text;
  v_node_level_key text;
  v_node_level_name text;
  v_node_entity_id uuid;
  v_node_diocese_id uuid;
  v_unit_entity_id uuid;
  v_unit_pastoral_area_id uuid;
begin
  select role_row.key
  into v_role_key
  from public.roles role_row
  where role_row.id = new.role_id;

  if v_role_key is null then
    raise exception 'Rol administrativo no encontrado.' using errcode = '23503';
  end if;

  if v_role_key = 'super_admin' then
    new.scope_type := 'global';
    new.scope_entity_id := null;
    new.country_iso2 := null;
    new.diocese_id := null;
    new.pastoral_area_id := null;
    new.organization_unit_id := null;
    new.structure_node_id := null;
    return new;
  end if;

  v_scope_type := app_private.normalize_authorization_scope_type(new.scope_type);
  if v_scope_type is null or v_scope_type in ('person','unknown') then
    raise exception 'El tipo de alcance administrativo no es válido.' using errcode = '23514';
  end if;
  if v_scope_type = 'global' then
    raise exception 'Solo super_admin puede conservar un alcance global.' using errcode = '23514';
  end if;
  new.scope_type := v_scope_type;

  if v_scope_type = 'national' then
    select entity_row.country_iso2, type_row.key
    into v_derived_country_iso2, v_entity_type_key
    from public.ecclesiastical_entities entity_row
    join public.entity_types type_row on type_row.id = entity_row.entity_type_id
    where entity_row.id = new.scope_entity_id
      and entity_row.status = 'active'
    limit 1;

    if v_derived_country_iso2 is null or v_entity_type_key <> 'country' then
      raise exception 'El alcance nacional requiere una entidad país activa.' using errcode = '23514';
    end if;
    new.diocese_id := null;
    new.pastoral_area_id := null;
    new.organization_unit_id := null;
    new.structure_node_id := null;
  elsif v_scope_type = 'diocese' then
    v_entity_id := coalesce(new.scope_entity_id, new.diocese_id);
    select type_row.key
    into v_entity_type_key
    from public.ecclesiastical_entities entity_row
    join public.entity_types type_row on type_row.id = entity_row.entity_type_id
    where entity_row.id = v_entity_id
      and entity_row.status = 'active';

    if v_entity_type_key not in ('archdiocese','diocese','military_ordinariate','apostolic_vicariate','apostolic_prefecture') then
      raise exception 'El alcance diocesano requiere una jurisdicción eclesiástica activa.' using errcode = '23514';
    end if;
    new.scope_entity_id := v_entity_id;
    new.diocese_id := v_entity_id;
    new.pastoral_area_id := null;
    new.organization_unit_id := null;
    new.structure_node_id := null;
    v_derived_country_iso2 := app_private.resolve_entity_country_iso2(v_entity_id);
  elsif v_scope_type in ('vicariate','zone') then
    if new.structure_node_id is null then
      raise exception 'El alcance de vicaría o zona requiere un nodo estructural.' using errcode = '23514';
    end if;

    select level_row.level_key, level_row.name,
           node_row.linked_ecclesiastical_entity_id, node_row.diocese_id
    into v_node_level_key, v_node_level_name, v_node_entity_id, v_node_diocese_id
    from public.structure_nodes node_row
    join public.structure_levels level_row on level_row.id = node_row.level_id
    where node_row.id = new.structure_node_id
      and node_row.status = 'active'
      and node_row.is_current = true;

    if v_node_level_key is null then
      raise exception 'El nodo estructural seleccionado no existe o no está vigente.' using errcode = '23514';
    end if;
    if v_scope_type = 'vicariate'
       and not (v_node_level_key ilike '%vicari%' or v_node_level_name ilike '%vicar%') then
      raise exception 'El nodo seleccionado no corresponde a una vicaría.' using errcode = '23514';
    end if;
    if v_scope_type = 'zone'
       and not (v_node_level_key ilike '%zona%' or v_node_level_key ilike '%zone%'
                or v_node_level_name ilike '%zona%' or v_node_level_name ilike '%zone%') then
      raise exception 'El nodo seleccionado no corresponde a una zona.' using errcode = '23514';
    end if;

    new.scope_entity_id := coalesce(v_node_entity_id, v_node_diocese_id);
    new.diocese_id := coalesce(new.diocese_id, v_node_diocese_id);
    new.pastoral_area_id := null;
    new.organization_unit_id := null;
    v_derived_country_iso2 := app_private.resolve_scope_country_iso2(
      v_scope_type, new.scope_entity_id, new.diocese_id, null, null, new.structure_node_id
    );
  elsif v_scope_type = 'parish' then
    select type_row.key, entity_row.country_iso2
    into v_entity_type_key, v_derived_country_iso2
    from public.ecclesiastical_entities entity_row
    join public.entity_types type_row on type_row.id = entity_row.entity_type_id
    where entity_row.id = new.scope_entity_id
      and entity_row.status = 'active';

    if v_entity_type_key not in ('parish','quasi_parish') then
      raise exception 'El alcance parroquial requiere una parroquia o cuasiparroquia activa.' using errcode = '23514';
    end if;
    new.diocese_id := coalesce(new.diocese_id, app_private.resolve_entity_diocese_id(new.scope_entity_id));
    new.pastoral_area_id := null;
    new.organization_unit_id := null;
    new.structure_node_id := null;
  elsif v_scope_type = 'entity' then
    if new.scope_entity_id is null
       or not exists (
         select 1 from public.ecclesiastical_entities entity_row
         where entity_row.id = new.scope_entity_id
           and entity_row.status = 'active'
       ) then
      raise exception 'El alcance de entidad requiere una entidad eclesial activa.' using errcode = '23514';
    end if;
    new.diocese_id := coalesce(new.diocese_id, app_private.resolve_entity_diocese_id(new.scope_entity_id));
    new.pastoral_area_id := null;
    new.organization_unit_id := null;
    new.structure_node_id := null;
    v_derived_country_iso2 := app_private.resolve_entity_country_iso2(new.scope_entity_id);
  elsif v_scope_type = 'pastoral_area' then
    new.pastoral_area_id := coalesce(new.pastoral_area_id, new.scope_entity_id);
    if new.pastoral_area_id is null
       or not exists (
         select 1 from public.pastoral_areas area_row
         where area_row.id = new.pastoral_area_id
           and area_row.status = 'active'
       ) then
      raise exception 'El alcance pastoral requiere un área pastoral activa.' using errcode = '23514';
    end if;
    new.scope_entity_id := null;
    new.diocese_id := null;
    new.organization_unit_id := null;
    new.structure_node_id := null;
    v_derived_country_iso2 := app_private.resolve_scope_country_iso2(
      v_scope_type, null, null, new.pastoral_area_id, null, null
    );
  elsif v_scope_type = 'organization_unit' then
    new.organization_unit_id := coalesce(new.organization_unit_id, new.scope_entity_id);
    select unit_row.ecclesiastical_entity_id, unit_row.pastoral_area_id
    into v_unit_entity_id, v_unit_pastoral_area_id
    from public.organization_units unit_row
    where unit_row.id = new.organization_unit_id
      and unit_row.status = 'active'
      and unit_row.is_current = true;

    if v_unit_entity_id is null then
      raise exception 'El alcance organizativo requiere una unidad activa y vigente.' using errcode = '23514';
    end if;
    new.scope_entity_id := v_unit_entity_id;
    new.diocese_id := app_private.resolve_entity_diocese_id(v_unit_entity_id);
    new.pastoral_area_id := v_unit_pastoral_area_id;
    new.structure_node_id := null;
    v_derived_country_iso2 := app_private.resolve_entity_country_iso2(v_unit_entity_id);
  end if;

  if v_derived_country_iso2 is null then
    raise exception 'No se pudo resolver el país del alcance administrativo.' using errcode = '23514';
  end if;
  if new.country_iso2 is not null and new.country_iso2 <> v_derived_country_iso2 then
    raise exception 'El país del alcance no coincide con la entidad seleccionada.' using errcode = '23514';
  end if;
  new.country_iso2 := v_derived_country_iso2;
  return new;
end;
$$;

create or replace function app_private.current_user_can_manage_structure_node(
  p_permission_key text,
  p_structure_node_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_user_id uuid := auth.uid();
  v_country_iso2 char(2);
  v_diocese_id uuid;
  v_linked_entity_id uuid;
  v_linked_unit_id uuid;
begin
  if v_user_id is null or p_structure_node_id is null or nullif(p_permission_key,'') is null then
    return false;
  end if;
  if not exists (
    select 1 from public.profiles profile_row
    where profile_row.id=v_user_id and profile_row.status='active'
  ) then
    return false;
  end if;
  if app_private.current_user_has_role(array['super_admin']) then
    return app_private.current_user_has_permission(p_permission_key);
  end if;

  select node_row.diocese_id, node_row.linked_ecclesiastical_entity_id,
         node_row.linked_organization_unit_id,
         app_private.resolve_scope_country_iso2(
           'entity', node_row.linked_ecclesiastical_entity_id, node_row.diocese_id,
           null, node_row.linked_organization_unit_id, node_row.id
         )
  into v_diocese_id, v_linked_entity_id, v_linked_unit_id, v_country_iso2
  from public.structure_nodes node_row
  where node_row.id=p_structure_node_id
    and node_row.status='active'
    and node_row.is_current=true;

  if v_country_iso2 is null or not app_private.current_user_can_access_country(v_country_iso2) then
    return false;
  end if;

  if v_linked_entity_id is not null
     and app_private.current_user_can_manage_entity(p_permission_key,v_linked_entity_id) then
    return true;
  end if;
  if v_linked_unit_id is not null
     and app_private.current_user_can_manage_organization_unit(p_permission_key,v_linked_unit_id) then
    return true;
  end if;

  return exists (
    with recursive node_lineage as (
      select node_row.id,node_row.parent_node_id
      from public.structure_nodes node_row
      where node_row.id=p_structure_node_id
      union all
      select parent_row.id,parent_row.parent_node_id
      from public.structure_nodes parent_row
      join node_lineage child_row on child_row.parent_node_id=parent_row.id
    )
    select 1
    from public.user_role_assignments assignment
    join public.role_permissions role_permission on role_permission.role_id=assignment.role_id
    join public.permissions permission_row on permission_row.id=role_permission.permission_id
    where assignment.user_id=v_user_id
      and assignment.status='active'
      and assignment.starts_at<=current_date
      and (assignment.ends_at is null or assignment.ends_at>=current_date)
      and assignment.country_iso2=v_country_iso2
      and permission_row.key=p_permission_key
      and (
        assignment.scope_type='national'
        or (assignment.scope_type='diocese' and assignment.diocese_id is not distinct from v_diocese_id)
        or assignment.structure_node_id in (select lineage.id from node_lineage lineage)
      )
  );
end;
$$;

create or replace function app_private.current_user_can_manage_entity(
  p_permission_key text,
  p_entity_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_country_iso2 char(2);
  v_diocese_id uuid;
  v_target_node_id uuid;
begin
  if v_user_id is null or p_entity_id is null or nullif(p_permission_key,'') is null then
    return false;
  end if;
  if not exists (
    select 1 from public.profiles profile_row
    where profile_row.id=v_user_id and profile_row.status='active'
  ) then
    return false;
  end if;
  if app_private.current_user_has_role(array['super_admin']) then
    return app_private.current_user_has_permission(p_permission_key);
  end if;

  v_target_country_iso2 := app_private.resolve_entity_country_iso2(p_entity_id);
  if v_target_country_iso2 is null
     or not app_private.current_user_can_access_country(v_target_country_iso2) then
    return false;
  end if;

  select node_row.id,node_row.diocese_id
  into v_target_node_id,v_diocese_id
  from public.structure_nodes node_row
  where node_row.linked_ecclesiastical_entity_id=p_entity_id
    and node_row.is_current=true
    and node_row.status='active'
  order by node_row.updated_at desc
  limit 1;
  v_diocese_id := coalesce(v_diocese_id,app_private.resolve_entity_diocese_id(p_entity_id));

  return exists (
    with recursive target_node_lineage as (
      select node_row.id,node_row.parent_node_id
      from public.structure_nodes node_row
      where node_row.id=v_target_node_id
      union all
      select parent_row.id,parent_row.parent_node_id
      from public.structure_nodes parent_row
      join target_node_lineage child_row on child_row.parent_node_id=parent_row.id
    )
    select 1
    from public.user_role_assignments assignment
    join public.role_permissions role_permission on role_permission.role_id=assignment.role_id
    join public.permissions permission_row on permission_row.id=role_permission.permission_id
    where assignment.user_id=v_user_id
      and assignment.status='active'
      and assignment.starts_at<=current_date
      and (assignment.ends_at is null or assignment.ends_at>=current_date)
      and assignment.country_iso2=v_target_country_iso2
      and permission_row.key=p_permission_key
      and (
        assignment.scope_type='national'
        or (
          assignment.scope_type='diocese'
          and v_diocese_id is not null
          and assignment.diocese_id is not distinct from v_diocese_id
        )
        or (
          assignment.scope_type in ('parish','entity')
          and assignment.scope_entity_id is not distinct from p_entity_id
        )
        or (
          v_target_node_id is not null
          and assignment.structure_node_id in (
            select lineage.id from target_node_lineage lineage
          )
        )
      )
  );
end;
$$;

create or replace function app_private.current_user_root_jurisdiction_id()
returns uuid
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select case assignment.scope_type
    when 'organization_unit' then assignment.organization_unit_id
    when 'pastoral_area' then assignment.pastoral_area_id
    when 'vicariate' then assignment.structure_node_id
    when 'zone' then assignment.structure_node_id
    else assignment.scope_entity_id
  end
  from public.user_role_assignments assignment
  join public.roles role_row on role_row.id=assignment.role_id
  where assignment.user_id=auth.uid()
    and assignment.status='active'
    and assignment.starts_at<=current_date
    and (assignment.ends_at is null or assignment.ends_at>=current_date)
    and role_row.key not in ('super_admin','national_admin')
    and (
      assignment.scope_entity_id is not null
      or assignment.structure_node_id is not null
      or assignment.pastoral_area_id is not null
      or assignment.organization_unit_id is not null
    )
  order by case assignment.scope_type
    when 'diocese' then 0
    when 'vicariate' then 1
    when 'zone' then 2
    when 'parish' then 3
    when 'organization_unit' then 4
    when 'pastoral_area' then 5
    else 6
  end,
  assignment.created_at desc,
  assignment.id
  limit 1;
$$;

revoke all on function app_private.normalize_authorization_scope_type(text) from public,anon,authenticated;
revoke all on function app_private.resolve_scope_country_iso2(text,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function app_private.current_user_can_manage_structure_node(text,uuid) from public,anon,authenticated;

comment on column public.user_role_assignments.structure_node_id
is 'Nodo estructural canónico para alcances de vicaría y zona; scope_entity_id queda reservado a ecclesiastical_entities.';
comment on function app_private.normalize_authorization_scope_type(text)
is 'Normaliza aliases históricos al vocabulario canónico de autorización administrativa.';
comment on function app_private.current_user_can_manage_structure_node(text,uuid)
is 'Autoriza un nodo estructural por país, permiso, diócesis o ancestro estructural sin reutilizar scope_entity_id con IDs de otras tablas.';