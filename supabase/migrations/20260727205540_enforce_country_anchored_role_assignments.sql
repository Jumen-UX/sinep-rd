begin;

create or replace function app_private.derive_role_assignment_country_context()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_role_key text;
  v_derived_country_iso2 char(2);
begin
  select role_row.key
  into v_role_key
  from public.roles role_row
  where role_row.id = new.role_id;

  if v_role_key is null then
    raise exception 'Rol administrativo no encontrado.' using errcode = '23503';
  end if;

  if v_role_key = 'super_admin' then
    new.country_iso2 := null;
    return new;
  end if;

  if new.scope_type = 'global' then
    raise exception 'Solo super_admin puede conservar un alcance global.' using errcode = '23514';
  end if;

  if new.scope_type = 'national' then
    select entity_row.country_iso2
    into v_derived_country_iso2
    from public.ecclesiastical_entities entity_row
    join public.entity_types type_row on type_row.id = entity_row.entity_type_id
    where entity_row.id = new.scope_entity_id
      and type_row.key = 'country'
      and entity_row.status = 'active'
    limit 1;

    if v_derived_country_iso2 is null then
      raise exception 'El alcance nacional requiere una entidad país activa.' using errcode = '23514';
    end if;
  else
    v_derived_country_iso2 := app_private.resolve_scope_country_iso2(
      new.scope_type,
      new.scope_entity_id,
      new.diocese_id,
      new.pastoral_area_id,
      new.organization_unit_id
    );
  end if;

  if new.country_iso2 is not null
     and v_derived_country_iso2 is not null
     and new.country_iso2 <> v_derived_country_iso2 then
    raise exception 'El país del alcance no coincide con la entidad seleccionada.' using errcode = '23514';
  end if;

  new.country_iso2 := coalesce(v_derived_country_iso2, new.country_iso2);
  return new;
end;
$$;

create or replace function app_private.admin_list_role_scope_options(p_scope_type text default null::text)
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
set search_path = public, app_private, auth, pg_temp
as $$
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('users.view')
    or app_private.current_user_has_permission('users.assign_roles')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para ver alcances de roles' using errcode='42501';
  end if;

  return query
  with requested as (select nullif(p_scope_type,'') as value)
  select 'national'::text, ee.id, ee.name::text,
         coalesce(catalog.name_es,catalog.name_en,'País')::text,
         'ecclesiastical_entities'::text,null::uuid,null::uuid
  from public.ecclesiastical_entities ee
  join public.entity_types et on et.id=ee.entity_type_id and et.key='country'
  join public.country_catalog catalog on catalog.iso2=ee.country_iso2
  cross join requested req
  where (req.value is null or req.value='national')
    and ee.status='active'
    and (
      app_private.current_user_has_role(array['super_admin'])
      or app_private.current_user_can_access_country(ee.country_iso2)
    )
  union all
  select 'diocese'::text,ee.id,ee.name::text,coalesce(et.name,et.key,'Jurisdicción')::text,
         'ecclesiastical_entities'::text,ee.id,null::uuid
  from public.ecclesiastical_entities ee
  join public.entity_types et on et.id=ee.entity_type_id
  cross join requested req
  where (req.value is null or req.value='diocese') and ee.status='active'
    and et.key in ('archdiocese','diocese','military_ordinariate')
    and (
      app_private.current_user_has_role(array['super_admin'])
      or app_private.current_user_can_access_country(ee.country_iso2)
    )
  union all
  select 'parish'::text,ee.id,ee.name::text,coalesce(et.name,et.key,'Parroquia')::text,
         'ecclesiastical_entities'::text,app_private.resolve_entity_diocese_id(ee.id),null::uuid
  from public.ecclesiastical_entities ee
  join public.entity_types et on et.id=ee.entity_type_id
  cross join requested req
  where (req.value is null or req.value='parish') and ee.status='active'
    and et.key in ('parish','quasi_parish')
    and (
      app_private.current_user_has_role(array['super_admin'])
      or app_private.current_user_can_access_country(ee.country_iso2)
    )
  union all
  select case
           when sl.level_key ilike '%vicari%' or sl.name ilike '%vicar%' then 'vicariate'
           when sl.level_key ilike '%zona%' or sl.level_key ilike '%zone%' or sl.name ilike '%zona%' or sl.name ilike '%zone%' then 'zone'
           else 'entity'
         end::text,
         sn.id,sn.name::text,concat_ws(' · ',st.name,sl.name)::text,'structure_nodes'::text,
         sn.diocese_id,sn.parent_node_id
  from public.structure_nodes sn
  join public.structure_levels sl on sl.id=sn.level_id
  join public.structure_templates st on st.id=sn.template_id
  cross join requested req
  where sn.status='active' and sn.is_current=true and st.status='active'
    and (
      req.value is null or req.value='entity'
      or (req.value='vicariate' and (sl.level_key ilike '%vicari%' or sl.name ilike '%vicar%'))
      or (req.value='zone' and (sl.level_key ilike '%zona%' or sl.level_key ilike '%zone%' or sl.name ilike '%zona%' or sl.name ilike '%zone%'))
    )
    and (
      app_private.current_user_has_role(array['super_admin'])
      or app_private.current_user_can_access_country(app_private.resolve_entity_country_iso2(sn.diocese_id))
    )
  union all
  select 'pastoral_area'::text,pa.id,pa.name::text,coalesce(pa.description,'Área pastoral')::text,
         'pastoral_areas'::text,null::uuid,null::uuid
  from public.pastoral_areas pa
  cross join requested req
  where (req.value is null or req.value='pastoral_area') and pa.status='active'
    and app_private.current_user_has_role(array['super_admin'])
  union all
  select 'organization_unit'::text,ou.id,ou.name::text,
         coalesce(oc.name,'Unidad organizativa')::text,'organization_units'::text,
         app_private.resolve_entity_diocese_id(ou.ecclesiastical_entity_id),ou.parent_unit_id
  from public.organization_units ou
  join public.organization_charts oc on oc.id=ou.organization_chart_id
  cross join requested req
  where (req.value is null or req.value='organization_unit')
    and ou.status='active' and ou.is_current=true
    and (
      app_private.current_user_has_role(array['super_admin'])
      or app_private.current_user_can_access_country(
        app_private.resolve_entity_country_iso2(ou.ecclesiastical_entity_id)
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
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role_id uuid := nullif(payload->>'role_id', '')::uuid;
  v_requested_role_key text := nullif(payload->>'role_key', '');
  v_role_key text;
  v_role_name text;
  v_scope_type text := coalesce(nullif(payload->>'scope_type', ''), 'national');
  v_scope_entity_id uuid := nullif(payload->>'scope_entity_id', '')::uuid;
  v_scope_label text;
  v_country_iso2 char(2);
begin
  if v_actor_id is null or not (
    app_private.current_user_has_permission('users.assign_roles')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para validar asignaciones de acceso' using errcode = '42501';
  end if;

  if v_role_id is null and v_requested_role_key is null then
    raise exception 'Debes seleccionar un rol' using errcode = '22023';
  end if;

  select r.id, r.key, r.name
  into v_role_id, v_role_key, v_role_name
  from public.roles r
  where r.id = v_role_id or r.key = v_requested_role_key
  limit 1;

  if not found then
    raise exception 'Rol no encontrado' using errcode = '22023';
  end if;

  if v_role_key = 'super_admin' and not app_private.current_user_has_role(array['super_admin']) then
    raise exception 'Solo un superadministrador puede asignar el rol super_admin' using errcode = '42501';
  end if;

  if v_scope_type not in ('global', 'national', 'diocese', 'vicariate', 'zone', 'parish', 'pastoral_area', 'organization_unit', 'entity') then
    raise exception 'Alcance de rol no permitido' using errcode = '22023';
  end if;

  if v_scope_type = 'global' then
    if not app_private.current_user_has_role(array['super_admin']) then
      raise exception 'Solo un superadministrador puede asignar alcance global' using errcode = '42501';
    end if;
    if v_scope_entity_id is not null then
      raise exception 'El alcance global no acepta una entidad concreta' using errcode = '22023';
    end if;
    v_scope_label := 'Global técnico';
  elsif v_scope_type = 'national' then
    if v_scope_entity_id is null then
      raise exception 'Debes seleccionar el país del alcance nacional' using errcode = '22023';
    end if;

    select ee.country_iso2, ee.name
    into v_country_iso2, v_scope_label
    from public.ecclesiastical_entities ee
    join public.entity_types et on et.id=ee.entity_type_id and et.key='country'
    where ee.id=v_scope_entity_id and ee.status='active'
    limit 1;

    if v_country_iso2 is null then
      raise exception 'La entidad seleccionada no es un país activo' using errcode = '22023';
    end if;
    if not app_private.current_user_has_role(array['super_admin'])
       and not app_private.current_user_can_access_country(v_country_iso2) then
      raise exception 'El país seleccionado no está disponible dentro de tu alcance' using errcode = '42501';
    end if;
  else
    if v_scope_entity_id is null then
      raise exception 'Debes seleccionar la entidad concreta del alcance' using errcode = '22023';
    end if;

    select option_row.label
    into v_scope_label
    from app_private.admin_list_role_scope_options(v_scope_type) option_row
    where option_row.scope_entity_id = v_scope_entity_id
    limit 1;

    if not found then
      raise exception 'La entidad seleccionada no está disponible dentro de tu alcance' using errcode = '42501';
    end if;

    v_country_iso2 := app_private.resolve_scope_country_iso2(
      v_scope_type,
      v_scope_entity_id,
      null,
      null,
      null
    );
  end if;

  return jsonb_build_object(
    'role_id', v_role_id,
    'role_key', v_role_key,
    'role_name', v_role_name,
    'scope_type', v_scope_type,
    'scope_entity_id', v_scope_entity_id,
    'scope_label', v_scope_label,
    'country_iso2', v_country_iso2
  );
end;
$$;

create or replace function app_private.admin_assign_user_role(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_user_id uuid := nullif(payload->>'user_id','')::uuid;
  v_role_id uuid := nullif(payload->>'role_id','')::uuid;
  v_role_key text := nullif(payload->>'role_key','');
  v_scope_type text := coalesce(nullif(payload->>'scope_type',''),'national');
  v_scope_entity_id uuid := nullif(payload->>'scope_entity_id','')::uuid;
  v_country_iso2 char(2);
  v_diocese_id uuid := nullif(payload->>'diocese_id','')::uuid;
  v_pastoral_area_id uuid := nullif(payload->>'pastoral_area_id','')::uuid;
  v_organization_unit_id uuid := coalesce(nullif(payload->>'organization_unit_id','')::uuid,
                                          case when v_scope_type='organization_unit' then v_scope_entity_id end);
  v_starts_at date := coalesce(nullif(payload->>'starts_at','')::date,current_date);
  v_ends_at date := nullif(payload->>'ends_at','')::date;
  v_assignment_id uuid;
  v_target_role_key text;
begin
  if v_actor_id is null or not (
    app_private.current_user_has_permission('users.assign_roles')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para asignar roles' using errcode='42501';
  end if;

  if v_user_id is null then raise exception 'Debes seleccionar un usuario' using errcode='22023'; end if;
  if v_role_id is null and v_role_key is null then raise exception 'Debes seleccionar un rol' using errcode='22023'; end if;

  select id,key into v_role_id,v_target_role_key
  from public.roles
  where id=v_role_id or key=v_role_key
  limit 1;

  if v_role_id is null then raise exception 'Rol no encontrado' using errcode='22023'; end if;
  if v_target_role_key='super_admin' and not app_private.current_user_has_role(array['super_admin']) then
    raise exception 'Solo un superadministrador puede asignar el rol super_admin' using errcode='42501';
  end if;

  if v_scope_type not in ('global','national','diocese','vicariate','zone','parish','pastoral_area','organization_unit','entity') then
    raise exception 'Alcance de rol no permitido' using errcode='22023';
  end if;
  if v_ends_at is not null and v_ends_at<v_starts_at then
    raise exception 'La fecha final no puede ser menor que la fecha inicial' using errcode='22023';
  end if;

  if v_scope_type='global' then
    if not app_private.current_user_has_role(array['super_admin']) then
      raise exception 'Solo un superadministrador puede asignar alcance global' using errcode='42501';
    end if;
    if v_scope_entity_id is not null then
      raise exception 'El alcance global no acepta una entidad concreta' using errcode='22023';
    end if;
  elsif v_scope_type='national' then
    if v_scope_entity_id is null then
      raise exception 'Debes seleccionar el país del alcance nacional' using errcode='22023';
    end if;

    select ee.country_iso2
    into v_country_iso2
    from public.ecclesiastical_entities ee
    join public.entity_types et on et.id=ee.entity_type_id and et.key='country'
    where ee.id=v_scope_entity_id and ee.status='active'
    limit 1;

    if v_country_iso2 is null then
      raise exception 'La entidad seleccionada no es un país activo' using errcode='22023';
    end if;
  else
    if v_scope_entity_id is null then
      raise exception 'Debes seleccionar la entidad concreta del alcance' using errcode='22023';
    end if;

    if v_scope_type='diocese' then
      v_diocese_id := coalesce(v_diocese_id,v_scope_entity_id);
    elsif v_scope_type in ('vicariate','zone','entity') then
      select coalesce(v_diocese_id,sn.diocese_id)
        into v_diocese_id
      from public.structure_nodes sn
      where sn.id=v_scope_entity_id
      limit 1;
    elsif v_scope_type='parish' then
      select coalesce(v_diocese_id,sn.diocese_id)
        into v_diocese_id
      from public.structure_nodes sn
      where sn.linked_ecclesiastical_entity_id=v_scope_entity_id
        and sn.is_current=true and sn.status='active'
      limit 1;
    elsif v_scope_type='pastoral_area' then
      v_pastoral_area_id := coalesce(v_pastoral_area_id,v_scope_entity_id);
    elsif v_scope_type='organization_unit' then
      select coalesce(v_organization_unit_id,ou.id),
             coalesce(v_pastoral_area_id,ou.pastoral_area_id),
             coalesce(v_diocese_id,app_private.resolve_entity_diocese_id(ou.ecclesiastical_entity_id))
        into v_organization_unit_id,v_pastoral_area_id,v_diocese_id
      from public.organization_units ou
      where ou.id=v_scope_entity_id
      limit 1;
    end if;

    v_country_iso2 := app_private.resolve_scope_country_iso2(
      v_scope_type,
      v_scope_entity_id,
      v_diocese_id,
      v_pastoral_area_id,
      v_organization_unit_id
    );
  end if;

  if v_country_iso2 is not null
     and not app_private.current_user_has_role(array['super_admin'])
     and not app_private.current_user_can_access_country(v_country_iso2) then
    raise exception 'El alcance seleccionado pertenece a otro país' using errcode='42501';
  end if;

  insert into public.profiles(id,email,full_name,status)
  select u.id,coalesce(u.email,''),coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),nullif(btrim(u.email),''),'Usuario SINEP'),'active'
  from auth.users u where u.id=v_user_id
  on conflict(id) do update set updated_at=now();

  if not found and not exists(select 1 from auth.users where id=v_user_id) then
    raise exception 'Usuario no encontrado en Supabase Auth' using errcode='22023';
  end if;

  select ura.id into v_assignment_id
  from public.user_role_assignments ura
  where ura.user_id=v_user_id
    and ura.role_id=v_role_id
    and ura.status='active'
    and ura.scope_type=v_scope_type
    and ura.scope_entity_id is not distinct from v_scope_entity_id
    and ura.country_iso2 is not distinct from v_country_iso2
    and ura.diocese_id is not distinct from v_diocese_id
    and ura.pastoral_area_id is not distinct from v_pastoral_area_id
    and ura.organization_unit_id is not distinct from v_organization_unit_id
    and ura.starts_at<=current_date
    and (ura.ends_at is null or ura.ends_at>=current_date)
  limit 1;

  if v_assignment_id is null then
    insert into public.user_role_assignments(
      user_id,role_id,scope_type,scope_entity_id,country_iso2,diocese_id,pastoral_area_id,organization_unit_id,
      starts_at,ends_at,status,created_by
    ) values (
      v_user_id,v_role_id,v_scope_type,v_scope_entity_id,v_country_iso2,v_diocese_id,v_pastoral_area_id,v_organization_unit_id,
      v_starts_at,v_ends_at,'active',v_actor_id
    ) returning id into v_assignment_id;
  end if;

  insert into public.audit_logs(
    user_id,action,target_table,target_id,new_data,country_iso2,organization_unit_id
  ) values(
    v_actor_id,'admin_assign_user_role','user_role_assignments',v_assignment_id,
    jsonb_build_object(
      'target_user_id',v_user_id,
      'role_id',v_role_id,
      'role_key',v_target_role_key,
      'scope_type',v_scope_type,
      'scope_entity_id',v_scope_entity_id,
      'country_iso2',v_country_iso2,
      'diocese_id',v_diocese_id,
      'pastoral_area_id',v_pastoral_area_id,
      'organization_unit_id',v_organization_unit_id
    ),
    v_country_iso2,
    v_organization_unit_id
  );

  return jsonb_build_object(
    'assignment_id',v_assignment_id,
    'user_id',v_user_id,
    'role_id',v_role_id,
    'role_key',v_target_role_key,
    'scope_type',v_scope_type,
    'scope_entity_id',v_scope_entity_id,
    'country_iso2',v_country_iso2,
    'diocese_id',v_diocese_id,
    'pastoral_area_id',v_pastoral_area_id,
    'organization_unit_id',v_organization_unit_id
  );
end;
$$;

revoke all on function app_private.derive_role_assignment_country_context() from public, anon, authenticated;
revoke all on function app_private.admin_list_role_scope_options(text) from public, anon, authenticated;
revoke all on function app_private.validate_admin_role_scope(jsonb) from public, anon, authenticated;
revoke all on function app_private.admin_assign_user_role(jsonb) from public, anon, authenticated;

commit;
