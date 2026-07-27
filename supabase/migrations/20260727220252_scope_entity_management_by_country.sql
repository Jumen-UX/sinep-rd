begin;

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
  v_target_country_iso2 char(2);
  v_diocese_id uuid;
  v_target_node_id uuid;
begin
  if v_user_id is null or p_entity_id is null or nullif(p_permission_key, '') is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles profile_row
    where profile_row.id = v_user_id
      and profile_row.status = 'active'
  ) then
    return false;
  end if;

  if app_private.current_user_has_role(array['super_admin']) then
    return true;
  end if;

  v_target_country_iso2 := app_private.resolve_entity_country_iso2(p_entity_id);

  if v_target_country_iso2 is null
     or not app_private.current_user_can_access_country(v_target_country_iso2) then
    return false;
  end if;

  select node_row.id, node_row.diocese_id
  into v_target_node_id, v_diocese_id
  from public.structure_nodes node_row
  where node_row.linked_ecclesiastical_entity_id = p_entity_id
    and node_row.is_current = true
    and node_row.status = 'active'
  order by node_row.updated_at desc
  limit 1;

  v_diocese_id := coalesce(v_diocese_id, app_private.resolve_entity_diocese_id(p_entity_id));

  return exists (
    with recursive target_node_lineage as (
      select node_row.id, node_row.parent_node_id, node_row.linked_ecclesiastical_entity_id
      from public.structure_nodes node_row
      where node_row.id = v_target_node_id

      union all

      select parent_row.id, parent_row.parent_node_id, parent_row.linked_ecclesiastical_entity_id
      from public.structure_nodes parent_row
      join target_node_lineage child_row on child_row.parent_node_id = parent_row.id
    )
    select 1
    from public.user_role_assignments assignment
    join public.role_permissions role_permission on role_permission.role_id = assignment.role_id
    join public.permissions permission_row on permission_row.id = role_permission.permission_id
    where assignment.user_id = v_user_id
      and assignment.status = 'active'
      and assignment.starts_at <= current_date
      and (assignment.ends_at is null or assignment.ends_at >= current_date)
      and assignment.country_iso2 = v_target_country_iso2
      and permission_row.key = p_permission_key
      and (
        assignment.scope_type = 'national'
        or assignment.scope_entity_id is not distinct from p_entity_id
        or (
          assignment.scope_type = 'diocese'
          and v_diocese_id is not null
          and coalesce(assignment.diocese_id, assignment.scope_entity_id) is not distinct from v_diocese_id
        )
        or (
          v_target_node_id is not null
          and assignment.scope_entity_id in (select id from target_node_lineage)
        )
        or (
          v_target_node_id is not null
          and assignment.scope_entity_id in (
            select linked_ecclesiastical_entity_id
            from target_node_lineage
            where linked_ecclesiastical_entity_id is not null
          )
        )
      )
  );
end;
$$;

create or replace function app_private.import_entity_matches(p_value text)
returns uuid[]
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  with normalized as (
    select nullif(btrim(p_value), '') as value
  ), candidate as (
    select entity_row.id, entity_row.name
    from public.ecclesiastical_entities entity_row
    cross join normalized input_row
    where input_row.value is not null
      and entity_row.status = 'active'
      and (
        (
          input_row.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          and entity_row.id = input_row.value::uuid
        )
        or lower(btrim(entity_row.name)) = lower(input_row.value)
        or lower(btrim(coalesce(entity_row.official_name, ''))) = lower(input_row.value)
        or lower(btrim(coalesce(entity_row.slug, ''))) = lower(input_row.value)
      )
      and app_private.current_user_can_manage_entity('imports.prepare', entity_row.id)
    order by entity_row.name, entity_row.id
    limit 20
  )
  select coalesce(array_agg(candidate.id order by candidate.name, candidate.id), '{}'::uuid[])
  from candidate;
$$;

create or replace function app_private.rpc_definer__admin_save_ecclesiastical_entity(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  clean_payload jsonb;
  save_result jsonb;
  v_parent_id uuid := app_private.audit_json_uuid(payload, 'parent_entity_id');
  v_entity_id uuid;
  v_new jsonb;
  v_parent_country_iso2 char(2);
  v_requested_country_iso2 char(2) := nullif(upper(btrim(payload->>'country_iso2')), '')::char(2);
  v_is_super boolean := app_private.current_user_has_role(array['super_admin']);
begin
  if not app_private.current_user_has_permission('entities.create_proposal')
     and not v_is_super then
    raise exception 'No autorizado para crear entidades' using errcode = '42501';
  end if;

  if v_parent_id is null then
    if not v_is_super then
      raise exception 'Debes seleccionar una entidad superior dentro de tu alcance' using errcode = '42501';
    end if;

    if v_requested_country_iso2 is null then
      raise exception 'Una entidad sin superior requiere un país explícito.' using errcode = '22023';
    end if;
  else
    if not app_private.current_user_can_manage_entity('entities.create_proposal', v_parent_id) then
      raise exception 'La entidad superior está fuera de tu alcance' using errcode = '42501';
    end if;

    v_parent_country_iso2 := app_private.resolve_entity_country_iso2(v_parent_id);
    if v_parent_country_iso2 is null then
      raise exception 'No se pudo resolver el país de la entidad superior.' using errcode = '22023';
    end if;

    if v_requested_country_iso2 is not null
       and v_requested_country_iso2 <> v_parent_country_iso2 then
      raise exception 'El país de la nueva entidad no coincide con su entidad superior.' using errcode = '22023';
    end if;
  end if;

  clean_payload := payload
    - 'structure_diocese_id'
    - 'structure_template_id'
    - 'structure_parent_node_id'
    - 'structure_parent_level_id'
    - 'structure_parent_level_key'
    - 'structure_linked_entity_id'
    - 'structure_parent_path';

  if v_parent_country_iso2 is not null then
    clean_payload := jsonb_set(
      clean_payload,
      '{country_iso2}',
      to_jsonb(v_parent_country_iso2::text),
      true
    );
  end if;

  save_result := internal.admin_save_ecclesiastical_entity(clean_payload);
  v_entity_id := app_private.audit_json_uuid(save_result, 'entity_id');

  select to_jsonb(entity_row)
  into v_new
  from public.ecclesiastical_entities entity_row
  where entity_row.id = v_entity_id;

  perform public.create_audit_log(
    auth.uid(),
    'entities.entity.created',
    'ecclesiastical_entities',
    v_entity_id,
    null,
    jsonb_build_object(
      'scope_entity_id', coalesce(v_parent_id, v_entity_id),
      'country_iso2', coalesce(v_parent_country_iso2, v_requested_country_iso2),
      'record', v_new,
      'result', save_result
    ),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

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

create or replace function app_private.rpc_definer__admin_save_jurisdiction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_type_key text := nullif(payload->>'entity_type_key', '');
  v_parent_id uuid := app_private.audit_json_uuid(payload, 'parent_entity_id');
  v_result jsonb;
  v_entity_id uuid;
  v_new jsonb;
  v_parent_country_iso2 char(2);
  v_requested_country_iso2 char(2) := nullif(upper(btrim(payload->>'country_iso2')), '')::char(2);
  v_is_super boolean := app_private.current_user_has_role(array['super_admin']);
  v_clean_payload jsonb := payload;
begin
  if not app_private.current_user_has_permission('entities.create_proposal')
     and not v_is_super then
    raise exception 'No autorizado para crear jurisdicciones' using errcode = '42501';
  end if;

  if v_type_key = 'country' then
    if not v_is_super then
      raise exception 'Solo un superadministrador puede crear una entidad país.' using errcode = '42501';
    end if;

    if v_parent_id is not null then
      raise exception 'Una entidad país no puede depender de otra jurisdicción territorial.' using errcode = '22023';
    end if;

    if v_requested_country_iso2 is null then
      raise exception 'La entidad país requiere un código ISO explícito.' using errcode = '22023';
    end if;
  else
    if v_parent_id is null then
      raise exception 'Debes seleccionar una jurisdicción superior.' using errcode = '22023';
    end if;

    if not app_private.current_user_can_manage_entity('entities.create_proposal', v_parent_id) then
      raise exception 'La jurisdicción superior está fuera de tu alcance' using errcode = '42501';
    end if;

    v_parent_country_iso2 := app_private.resolve_entity_country_iso2(v_parent_id);
    if v_parent_country_iso2 is null then
      raise exception 'No se pudo resolver el país de la jurisdicción superior.' using errcode = '22023';
    end if;

    if v_requested_country_iso2 is not null
       and v_requested_country_iso2 <> v_parent_country_iso2 then
      raise exception 'El país de la nueva jurisdicción no coincide con su jurisdicción superior.' using errcode = '22023';
    end if;

    v_clean_payload := jsonb_set(
      v_clean_payload,
      '{country_iso2}',
      to_jsonb(v_parent_country_iso2::text),
      true
    );
  end if;

  v_result := internal.admin_save_jurisdiction(v_clean_payload);
  v_entity_id := app_private.audit_json_uuid(v_result, 'entity_id');

  select to_jsonb(entity_row)
  into v_new
  from public.ecclesiastical_entities entity_row
  where entity_row.id = v_entity_id;

  perform public.create_audit_log(
    auth.uid(),
    'entities.jurisdiction.created',
    'ecclesiastical_entities',
    v_entity_id,
    null,
    jsonb_build_object(
      'scope_entity_id', coalesce(v_parent_id, v_entity_id),
      'country_iso2', coalesce(v_parent_country_iso2, v_requested_country_iso2),
      'record', v_new,
      'result', v_result
    ),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

revoke all on function app_private.current_user_can_manage_entity(text, uuid) from public, anon, authenticated;
revoke all on function app_private.import_entity_matches(text) from public, anon, authenticated;
revoke all on function app_private.rpc_definer__admin_save_ecclesiastical_entity(jsonb) from public, anon, authenticated;
revoke all on function app_private.rpc_definer__admin_save_jurisdiction(jsonb) from public, anon, authenticated;

comment on function app_private.current_user_can_manage_entity(text, uuid) is
  'Checks effective permission and canonical territorial scope. super_admin is global; national roles are limited to assignment.country_iso2.';

commit;
