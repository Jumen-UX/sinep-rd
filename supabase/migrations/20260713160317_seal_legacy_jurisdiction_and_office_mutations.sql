create or replace function public.admin_save_jurisdiction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_type_key text := nullif(payload->>'entity_type_key', '');
  v_parent_id uuid := app_private.audit_json_uuid(payload, 'parent_entity_id');
  v_result jsonb;
  v_entity_id uuid;
  v_new jsonb;
begin
  if not app_private.current_user_has_permission('entities.create_proposal')
     and not app_private.current_user_is_super_or_national() then
    raise exception 'No autorizado para crear jurisdicciones' using errcode = '42501';
  end if;

  if v_type_key in ('country', 'ecclesiastical_province', 'archdiocese', 'diocese', 'military_ordinariate')
     and not app_private.current_user_is_super_or_national() then
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

  v_result := internal.admin_save_jurisdiction(payload);
  v_entity_id := app_private.audit_json_uuid(v_result, 'entity_id');
  select to_jsonb(ee) into v_new
  from public.ecclesiastical_entities ee
  where ee.id = v_entity_id;

  perform public.create_audit_log(
    auth.uid(),
    'entities.jurisdiction.created',
    'ecclesiastical_entities',
    v_entity_id,
    null,
    jsonb_build_object(
      'scope_entity_id', coalesce(v_parent_id, v_entity_id),
      'record', v_new,
      'result', v_result
    ),
    app_private.audit_json_uuid(payload, 'change_request_id')
  );

  return v_result;
end;
$$;

create or replace function public.admin_save_office_configuration(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_result jsonb;
  v_id uuid;
begin
  if not app_private.current_user_is_super_or_national() then
    raise exception 'Solo la administración nacional puede crear cargos canónicos globales' using errcode = '42501';
  end if;

  v_result := internal.admin_save_office_configuration(payload);
  v_id := app_private.audit_json_uuid(v_result, 'office_configuration_id');
  perform internal.apply_office_canonical_rules(v_id, payload);

  return v_result || jsonb_build_object(
    'required_ordination_degree', coalesce(nullif(payload->>'required_ordination_degree', ''), 'none'),
    'holder_cardinality', coalesce(nullif(payload->>'holder_cardinality', ''), 'single')
  );
end;
$$;

create or replace function public.admin_update_office_configuration(
  p_office_configuration_id uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
begin
  if not app_private.current_user_is_super_or_national() then
    raise exception 'Solo la administración nacional puede editar cargos canónicos globales' using errcode = '42501';
  end if;

  return internal.admin_update_office_configuration(p_office_configuration_id, payload);
end;
$$;

create or replace function public.editor_suggest_office_configuration(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_scope_type text := coalesce(nullif(payload->>'scope_type', ''), 'entity');
  v_scope_entity_id uuid := app_private.audit_json_uuid(payload, 'scope_entity_id');
  v_diocese_id uuid := app_private.audit_json_uuid(payload, 'diocese_id');
  v_pastoral_area_id uuid := app_private.audit_json_uuid(payload, 'pastoral_area_id');
  v_pastoral_entity_id uuid := app_private.audit_json_uuid(payload, 'pastoral_entity_id');
begin
  if auth.uid() is null or not app_private.current_user_has_any_active_role() then
    raise exception 'Debes tener un rol activo para sugerir cargos' using errcode = '42501';
  end if;

  if app_private.current_user_is_super_or_national() then
    return internal.editor_suggest_office_configuration(payload);
  end if;

  if v_scope_entity_id is null
     and v_diocese_id is null
     and v_pastoral_area_id is null
     and v_pastoral_entity_id is null then
    raise exception 'La sugerencia debe indicar un alcance territorial' using errcode = '42501';
  end if;

  if not app_private.current_user_has_scope_access(
    v_scope_type,
    coalesce(v_scope_entity_id, v_diocese_id, v_pastoral_area_id, v_pastoral_entity_id),
    v_diocese_id,
    v_pastoral_area_id,
    v_pastoral_entity_id
  ) then
    raise exception 'El alcance de la sugerencia está fuera de tu jurisdicción' using errcode = '42501';
  end if;

  return internal.editor_suggest_office_configuration(payload);
end;
$$;

create or replace function public.resolve_assignment_canonical_incompatibility(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'internal', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_assignment_id uuid := app_private.audit_json_uuid(payload, 'assignment_id');
  v_entity_id uuid;
begin
  if not app_private.current_user_has_permission('appointments.approve')
     and not app_private.current_user_is_super_or_national() then
    raise exception 'No autorizado para resolver incompatibilidades de nombramientos' using errcode = '42501';
  end if;

  select pa.ecclesiastical_entity_id
  into v_entity_id
  from public.position_assignments pa
  where pa.id = v_assignment_id;

  if v_assignment_id is null or v_entity_id is null then
    raise exception 'Nombramiento no encontrado o sin entidad administrable' using errcode = '22023';
  end if;

  if not app_private.current_user_can_manage_entity('appointments.approve', v_entity_id) then
    raise exception 'El nombramiento está fuera de tu alcance' using errcode = '42501';
  end if;

  return internal.resolve_assignment_canonical_incompatibility(payload);
end;
$$;

revoke all on function internal.admin_save_jurisdiction(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_save_office_configuration(jsonb) from public, anon, authenticated;
revoke all on function internal.admin_update_office_configuration(uuid, jsonb) from public, anon, authenticated;
revoke all on function internal.apply_office_canonical_rules(uuid, jsonb) from public, anon, authenticated;
revoke all on function internal.editor_suggest_office_configuration(jsonb) from public, anon, authenticated;
revoke all on function internal.resolve_assignment_canonical_incompatibility(jsonb) from public, anon, authenticated;

grant execute on function public.admin_save_jurisdiction(jsonb) to authenticated, service_role;
grant execute on function public.admin_save_office_configuration(jsonb) to authenticated, service_role;
grant execute on function public.admin_update_office_configuration(uuid, jsonb) to authenticated, service_role;
grant execute on function public.editor_suggest_office_configuration(jsonb) to authenticated, service_role;
grant execute on function public.resolve_assignment_canonical_incompatibility(jsonb) to authenticated, service_role;
