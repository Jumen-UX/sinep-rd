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
  elsif v_scope_type = 'entity' and new.structure_node_id is not null then
    select node_row.linked_ecclesiastical_entity_id, node_row.diocese_id
    into v_node_entity_id, v_node_diocese_id
    from public.structure_nodes node_row
    where node_row.id = new.structure_node_id
      and node_row.status = 'active'
      and node_row.is_current = true;

    if not found then
      raise exception 'El nodo estructural seleccionado no existe o no está vigente.' using errcode = '23514';
    end if;
    new.scope_entity_id := coalesce(v_node_entity_id, v_node_diocese_id);
    new.diocese_id := coalesce(new.diocese_id, v_node_diocese_id);
    new.pastoral_area_id := null;
    new.organization_unit_id := null;
    v_derived_country_iso2 := app_private.resolve_scope_country_iso2(
      v_scope_type, new.scope_entity_id, new.diocese_id, null, null, new.structure_node_id
    );
  elsif v_scope_type = 'entity' then
    if new.scope_entity_id is null
       or not exists (
         select 1 from public.ecclesiastical_entities entity_row
         where entity_row.id = new.scope_entity_id
           and entity_row.status = 'active'
       ) then
      raise exception 'El alcance de entidad requiere una entidad eclesial o nodo estructural activo.' using errcode = '23514';
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

comment on function app_private.derive_role_assignment_country_context()
is 'Normaliza y valida el destino de una asignación sin borrar structure_node_id en alcances entity basados en nodos.';