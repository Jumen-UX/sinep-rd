create or replace function app_private.validate_admin_role_scope(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
stable
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_role_id uuid := nullif(payload->>'role_id', '')::uuid;
  v_requested_role_key text := nullif(payload->>'role_key', '');
  v_role_key text;
  v_role_name text;
  v_scope_type text := coalesce(nullif(payload->>'scope_type', ''), 'national');
  v_scope_entity_id uuid := nullif(payload->>'scope_entity_id', '')::uuid;
  v_scope_label text;
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

  if v_scope_type in ('global', 'national') then
    if v_scope_entity_id is not null then
      raise exception 'El alcance global o nacional no acepta una entidad concreta' using errcode = '22023';
    end if;
    v_scope_label := case when v_scope_type = 'global' then 'Global técnico' else 'Nacional' end;
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
  end if;

  return jsonb_build_object(
    'role_id', v_role_id,
    'role_key', v_role_key,
    'role_name', v_role_name,
    'scope_type', v_scope_type,
    'scope_entity_id', v_scope_entity_id,
    'scope_label', v_scope_label
  );
end;
$function$;

create or replace function public.validate_admin_role_scope(payload jsonb)
returns jsonb
language sql
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
stable
as $function$
  select app_private.validate_admin_role_scope(payload);
$function$;

revoke all on function app_private.validate_admin_role_scope(jsonb) from public, anon, authenticated;
revoke all on function public.validate_admin_role_scope(jsonb) from public, anon;
grant execute on function app_private.validate_admin_role_scope(jsonb) to service_role;
grant execute on function public.validate_admin_role_scope(jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
