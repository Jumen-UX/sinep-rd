-- Priority 0: enforce exact permissions and jurisdiction scope on critical admin writes.
-- Applied to Supabase project hrvgpceqaxujlttpimdz on 2026-07-10.

begin;

insert into public.permissions (key, module, description)
values ('structures.manage', 'structures', 'Configurar plantillas, niveles y nodos estructurales dentro del alcance asignado.')
on conflict (key) do update
set module = excluded.module,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'structures.manage'
where r.key in ('super_admin', 'national_admin', 'diocesan_admin')
on conflict do nothing;

create or replace function app_private.resolve_entity_diocese_id(p_entity_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with recursive entity_lineage as (
    select ee.id, et.key as entity_type_key, 0 as depth
    from public.ecclesiastical_entities ee
    join public.entity_types et on et.id = ee.entity_type_id
    where ee.id = p_entity_id

    union all

    select parent.id, parent_type.key, child.depth + 1
    from entity_lineage child
    join public.entity_relationships er
      on er.child_entity_id = child.id
     and er.is_current = true
     and er.status = 'active'
    join public.ecclesiastical_entities parent on parent.id = er.parent_entity_id
    join public.entity_types parent_type on parent_type.id = parent.entity_type_id
    where child.depth < 20
  ),
  structure_match as (
    select sn.diocese_id, 0 as priority
    from public.structure_nodes sn
    where sn.linked_ecclesiastical_entity_id = p_entity_id
      and sn.is_current = true
      and sn.status = 'active'
    order by sn.updated_at desc
    limit 1
  ),
  entity_match as (
    select el.id as diocese_id, 1 as priority
    from entity_lineage el
    where el.entity_type_key in ('archdiocese', 'diocese', 'military_ordinariate')
    order by el.depth
    limit 1
  )
  select matches.diocese_id
  from (
    select * from structure_match
    union all
    select * from entity_match
  ) matches
  where matches.diocese_id is not null
  order by matches.priority
  limit 1;
$$;

revoke all on function app_private.resolve_entity_diocese_id(uuid) from public, anon, authenticated;
grant execute on function app_private.resolve_entity_diocese_id(uuid) to authenticated;

create or replace function app_private.current_user_can_manage_entity(
  p_permission_key text,
  p_entity_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_diocese_id uuid;
  v_target_node_id uuid;
begin
  if v_user_id is null or p_entity_id is null or nullif(p_permission_key, '') is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles pr
    where pr.id = v_user_id
      and pr.status = 'active'
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    where ura.user_id = v_user_id
      and ura.status = 'active'
      and ura.starts_at <= current_date
      and (ura.ends_at is null or ura.ends_at >= current_date)
      and r.key in ('super_admin', 'national_admin')
  ) then
    return true;
  end if;

  select sn.id, sn.diocese_id
    into v_target_node_id, v_diocese_id
  from public.structure_nodes sn
  where sn.linked_ecclesiastical_entity_id = p_entity_id
    and sn.is_current = true
    and sn.status = 'active'
  order by sn.updated_at desc
  limit 1;

  v_diocese_id := coalesce(v_diocese_id, app_private.resolve_entity_diocese_id(p_entity_id));

  return exists (
    with recursive target_node_lineage as (
      select sn.id, sn.parent_node_id, sn.linked_ecclesiastical_entity_id
      from public.structure_nodes sn
      where sn.id = v_target_node_id

      union all

      select parent.id, parent.parent_node_id, parent.linked_ecclesiastical_entity_id
      from public.structure_nodes parent
      join target_node_lineage child on child.parent_node_id = parent.id
    )
    select 1
    from public.user_role_assignments ura
    join public.role_permissions rp on rp.role_id = ura.role_id
    join public.permissions permission_row on permission_row.id = rp.permission_id
    where ura.user_id = v_user_id
      and ura.status = 'active'
      and ura.starts_at <= current_date
      and (ura.ends_at is null or ura.ends_at >= current_date)
      and permission_row.key = p_permission_key
      and (
        ura.scope_type in ('global', 'national')
        or ura.scope_entity_id is not distinct from p_entity_id
        or (
          ura.scope_type = 'diocese'
          and v_diocese_id is not null
          and coalesce(ura.diocese_id, ura.scope_entity_id) is not distinct from v_diocese_id
        )
        or (
          v_target_node_id is not null
          and ura.scope_entity_id in (select id from target_node_lineage)
        )
        or (
          v_target_node_id is not null
          and ura.scope_entity_id in (
            select linked_ecclesiastical_entity_id
            from target_node_lineage
            where linked_ecclesiastical_entity_id is not null
          )
        )
      )
  );
end;
$$;

revoke all on function app_private.current_user_can_manage_entity(text, uuid) from public, anon, authenticated;
grant execute on function app_private.current_user_can_manage_entity(text, uuid) to authenticated;

create or replace function public.current_user_can_manage_entity(
  p_permission_key text,
  p_entity_id uuid
)
returns boolean
language sql
stable
set search_path = public, app_private, auth, pg_temp
as $$
  select app_private.current_user_can_manage_entity(p_permission_key, p_entity_id);
$$;

revoke all on function public.current_user_can_manage_entity(text, uuid) from public, anon;
grant execute on function public.current_user_can_manage_entity(text, uuid) to authenticated;

create or replace function public.admin_save_position_assignment(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_entity_id uuid := nullif(payload->>'ecclesiastical_entity_id', '')::uuid;
  v_pastoral_entity_id uuid := nullif(payload->>'pastoral_entity_id', '')::uuid;
  v_unit_id uuid := nullif(payload->>'organization_unit_id', '')::uuid;
  v_predecessor_id uuid := nullif(payload->>'predecessor_assignment_id', '')::uuid;
  v_successor_id uuid := nullif(payload->>'successor_assignment_id', '')::uuid;
  v_related_entity_id uuid;
  v_related_pastoral_id uuid;
begin
  if not public.current_user_has_permission('appointments.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear nombramientos' using errcode = '42501';
  end if;

  if v_unit_id is not null then
    select ou.ecclesiastical_entity_id, ou.pastoral_entity_id
      into v_related_entity_id, v_related_pastoral_id
    from public.organization_units ou
    where ou.id = v_unit_id;

    v_entity_id := coalesce(v_entity_id, v_related_entity_id);
    v_pastoral_entity_id := coalesce(v_pastoral_entity_id, v_related_pastoral_id);
  end if;

  if v_entity_id is null and v_pastoral_entity_id is null
     and not public.current_user_is_super_or_national() then
    raise exception 'El nombramiento debe indicar una entidad dentro de tu alcance' using errcode = '42501';
  end if;

  if v_entity_id is not null
     and not app_private.current_user_can_manage_entity('appointments.create_proposal', v_entity_id) then
    raise exception 'La entidad del nombramiento está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_pastoral_entity_id is not null
     and not (
       public.current_user_has_permission('appointments.create_proposal')
       and public.current_user_has_scope_access('pastoral_entity', v_pastoral_entity_id, null, null, v_pastoral_entity_id)
     )
     and not public.current_user_is_super_or_national() then
    raise exception 'La entidad pastoral del nombramiento está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_predecessor_id is not null then
    select pa.ecclesiastical_entity_id, pa.pastoral_entity_id
      into v_related_entity_id, v_related_pastoral_id
    from public.position_assignments pa
    where pa.id = v_predecessor_id;

    if v_related_entity_id is not null
       and not app_private.current_user_can_manage_entity('appointments.create_proposal', v_related_entity_id) then
      raise exception 'El nombramiento predecesor está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  if v_successor_id is not null then
    select pa.ecclesiastical_entity_id, pa.pastoral_entity_id
      into v_related_entity_id, v_related_pastoral_id
    from public.position_assignments pa
    where pa.id = v_successor_id;

    if v_related_entity_id is not null
       and not app_private.current_user_can_manage_entity('appointments.create_proposal', v_related_entity_id) then
      raise exception 'El nombramiento sucesor está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  return internal.admin_save_position_assignment(payload);
end;
$$;

create or replace function public.admin_save_priest(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_target_entity_id uuid := coalesce(
    nullif(payload->>'quick_entity_id', '')::uuid,
    nullif(payload->>'current_service_entity_id', '')::uuid,
    nullif(payload->>'incardination_entity_id', '')::uuid,
    nullif(payload->>'religious_house_entity_id', '')::uuid
  );
  v_has_assignment boolean := nullif(payload->>'quick_office_configuration_id', '') is not null;
begin
  if not public.current_user_has_permission('people.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear personas' using errcode = '42501';
  end if;

  if v_target_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'Debes indicar una entidad de incardinación o servicio dentro de tu alcance' using errcode = '42501';
  end if;

  if v_target_entity_id is not null
     and not app_private.current_user_can_manage_entity('people.create_proposal', v_target_entity_id) then
    raise exception 'La entidad seleccionada para el sacerdote está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_has_assignment then
    if not public.current_user_has_permission('appointments.create_proposal')
       and not public.current_user_is_super_or_national() then
      raise exception 'No autorizado para crear el nombramiento del sacerdote' using errcode = '42501';
    end if;

    if v_target_entity_id is null
       or not app_private.current_user_can_manage_entity('appointments.create_proposal', v_target_entity_id) then
      raise exception 'La entidad del nombramiento está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  return internal.admin_save_priest(payload);
end;
$$;

create or replace function public.admin_save_bishop(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_target_entity_id uuid := coalesce(
    nullif(payload->>'assignment_entity_id', '')::uuid,
    nullif(payload->>'incardination_entity_id', '')::uuid
  );
  v_has_assignment boolean := nullif(payload->>'office_configuration_id', '') is not null;
begin
  if not public.current_user_has_permission('people.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear personas' using errcode = '42501';
  end if;

  if v_target_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'Debes indicar una jurisdicción dentro de tu alcance' using errcode = '42501';
  end if;

  if v_target_entity_id is not null
     and not app_private.current_user_can_manage_entity('people.create_proposal', v_target_entity_id) then
    raise exception 'La jurisdicción seleccionada para el obispo está fuera de tu alcance' using errcode = '42501';
  end if;

  if v_has_assignment
     and not app_private.current_user_can_manage_entity('appointments.create_proposal', v_target_entity_id) then
    raise exception 'No autorizado para crear el nombramiento episcopal en esta jurisdicción' using errcode = '42501';
  end if;

  return internal.admin_save_bishop(payload);
end;
$$;

create or replace function public.admin_save_ecclesiastical_entity(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  clean_payload jsonb;
  save_result jsonb;
  v_parent_id uuid := nullif(payload->>'parent_entity_id', '')::uuid;
begin
  if not public.current_user_has_permission('entities.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear entidades' using errcode = '42501';
  end if;

  if v_parent_id is null and not public.current_user_is_super_or_national() then
    raise exception 'Debes seleccionar una entidad superior dentro de tu alcance' using errcode = '42501';
  end if;

  if v_parent_id is not null
     and not app_private.current_user_can_manage_entity('entities.create_proposal', v_parent_id) then
    raise exception 'La entidad superior está fuera de tu alcance' using errcode = '42501';
  end if;

  clean_payload := payload
    - 'structure_diocese_id'
    - 'structure_template_id'
    - 'structure_parent_node_id'
    - 'structure_parent_level_id'
    - 'structure_parent_level_key'
    - 'structure_linked_entity_id'
    - 'structure_parent_path';

  save_result := internal.admin_save_ecclesiastical_entity(clean_payload);

  return save_result || jsonb_build_object(
    'structure_context_received', jsonb_build_object(
      'diocese_id', payload ->> 'structure_diocese_id',
      'template_id', payload ->> 'structure_template_id',
      'parent_node_id', payload ->> 'structure_parent_node_id',
      'parent_level_id', payload ->> 'structure_parent_level_id',
      'parent_level_key', payload ->> 'structure_parent_level_key',
      'linked_entity_id', payload ->> 'structure_linked_entity_id',
      'path', payload ->> 'structure_parent_path'
    )
  );
end;
$$;

create or replace function public.admin_save_jurisdiction(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_type_key text := nullif(payload->>'entity_type_key', '');
  v_parent_id uuid := nullif(payload->>'parent_entity_id', '')::uuid;
begin
  if not public.current_user_has_permission('entities.create_proposal')
     and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear jurisdicciones' using errcode = '42501';
  end if;

  if v_type_key in ('country', 'ecclesiastical_province', 'archdiocese', 'diocese', 'military_ordinariate')
     and not public.current_user_is_super_or_national() then
    raise exception 'Solo la administración nacional puede crear jurisdicciones mayores' using errcode = '42501';
  end if;

  if v_type_key not in ('country', 'ecclesiastical_province', 'archdiocese', 'diocese', 'military_ordinariate') then
    if v_parent_id is null then
      raise exception 'Debes seleccionar una jurisdicción superior' using errcode = '42501';
    end if;

    if not app_private.current_user_can_manage_entity('entities.create_proposal', v_parent_id) then
      raise exception 'La jurisdicción superior está fuera de tu alcance' using errcode = '42501';
    end if;
  end if;

  return internal.admin_save_jurisdiction(payload);
end;
$$;

create or replace function public.admin_save_structure_template(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_diocese_id uuid := nullif(payload->>'diocese_id', '')::uuid;
begin
  if v_diocese_id is null
     or not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para configurar estructuras en esta diócesis' using errcode = '42501';
  end if;

  return internal.admin_save_structure_template(payload);
end;
$$;

create or replace function public.admin_save_structure_level(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_template_id uuid := nullif(payload->>'template_id', '')::uuid;
  v_diocese_id uuid;
begin
  select st.diocese_id into v_diocese_id
  from public.structure_templates st
  where st.id = v_template_id;

  if v_diocese_id is null
     or not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para configurar niveles en esta diócesis' using errcode = '42501';
  end if;

  return internal.admin_save_structure_level(payload);
end;
$$;

create or replace function public.admin_save_structure_node(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_template_id uuid := nullif(payload->>'template_id', '')::uuid;
  v_diocese_id uuid;
begin
  select st.diocese_id into v_diocese_id
  from public.structure_templates st
  where st.id = v_template_id;

  if v_diocese_id is null
     or not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para modificar nodos en esta diócesis' using errcode = '42501';
  end if;

  return internal.admin_save_structure_node(payload);
end;
$$;

revoke all on function public.admin_save_position_assignment(jsonb) from public, anon;
revoke all on function public.admin_save_priest(jsonb) from public, anon;
revoke all on function public.admin_save_bishop(jsonb) from public, anon;
revoke all on function public.admin_save_ecclesiastical_entity(jsonb) from public, anon;
revoke all on function public.admin_save_jurisdiction(jsonb) from public, anon;
revoke all on function public.admin_save_structure_template(jsonb) from public, anon;
revoke all on function public.admin_save_structure_level(jsonb) from public, anon;
revoke all on function public.admin_save_structure_node(jsonb) from public, anon;

grant execute on function public.admin_save_position_assignment(jsonb) to authenticated;
grant execute on function public.admin_save_priest(jsonb) to authenticated;
grant execute on function public.admin_save_bishop(jsonb) to authenticated;
grant execute on function public.admin_save_ecclesiastical_entity(jsonb) to authenticated;
grant execute on function public.admin_save_jurisdiction(jsonb) to authenticated;
grant execute on function public.admin_save_structure_template(jsonb) to authenticated;
grant execute on function public.admin_save_structure_level(jsonb) to authenticated;
grant execute on function public.admin_save_structure_node(jsonb) to authenticated;

commit;
