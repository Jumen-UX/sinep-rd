create or replace function app_private.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    nullif(btrim(new.email), ''),
    'Usuario SINEP'
  );

  insert into public.profiles (id, email, full_name, status)
  values (new.id, coalesce(new.email, ''), v_full_name, 'pending_invitation')
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    updated_at = now();

  return new;
end;
$function$;

create or replace function app_private.admin_update_user_profile_status(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_user_id uuid := nullif(payload->>'user_id', '')::uuid;
  v_requested_status text := coalesce(nullif(payload->>'status', ''), 'active');
  v_status text;
  v_old_profile public.profiles%rowtype;
  v_has_super_admin boolean;
  v_remaining_super_admins integer;
begin
  if v_actor_id is null or not (
    app_private.current_user_has_permission('users.manage')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para gestionar usuarios' using errcode = '42501';
  end if;

  if v_user_id is null then
    raise exception 'Debes seleccionar un usuario' using errcode = '22023';
  end if;

  v_status := case v_requested_status
    when 'pending' then 'pending_invitation'
    when 'disabled' then 'inactive'
    else v_requested_status
  end;

  if v_user_id = v_actor_id and v_status in ('suspended', 'inactive') then
    raise exception 'No puedes suspender o desactivar tu propio usuario' using errcode = '42501';
  end if;

  if v_status not in ('pending_invitation', 'active', 'suspended', 'inactive') then
    raise exception 'Estado de usuario no permitido' using errcode = '22023';
  end if;

  select * into v_old_profile from public.profiles where id = v_user_id for update;

  if not found then
    insert into public.profiles (id, email, full_name, status)
    select u.id, coalesce(u.email, ''), coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), nullif(btrim(u.email), ''), 'Usuario SINEP'), v_status
    from auth.users u
    where u.id = v_user_id
    returning * into v_old_profile;
  end if;

  if not found and not exists (select 1 from auth.users where id = v_user_id) then
    raise exception 'Usuario no encontrado en Supabase Auth' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    where ura.user_id = v_user_id
      and r.key = 'super_admin'
      and ura.status = 'active'
      and ura.starts_at <= current_date
      and (ura.ends_at is null or ura.ends_at >= current_date)
  ) into v_has_super_admin;

  if v_has_super_admin and not app_private.current_user_has_role(array['super_admin']) then
    raise exception 'Solo un superadministrador puede modificar otro superadministrador' using errcode = '42501';
  end if;

  if v_has_super_admin and v_status in ('suspended', 'inactive') then
    select count(*) into v_remaining_super_admins
    from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    join public.profiles pr on pr.id = ura.user_id
    where r.key = 'super_admin'
      and ura.user_id <> v_user_id
      and pr.status = 'active'
      and ura.status = 'active'
      and ura.starts_at <= current_date
      and (ura.ends_at is null or ura.ends_at >= current_date);

    if v_remaining_super_admins < 1 then
      raise exception 'No puedes desactivar el último superadministrador activo' using errcode = '42501';
    end if;
  end if;

  update public.profiles
  set status = v_status,
      updated_at = now()
  where id = v_user_id;

  insert into public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
  values (
    v_actor_id,
    'admin_update_user_profile_status',
    'profiles',
    v_user_id,
    to_jsonb(v_old_profile),
    jsonb_build_object('status', v_status, 'requested_status', v_requested_status)
  );

  return jsonb_build_object('user_id', v_user_id, 'status', v_status);
end;
$function$;
