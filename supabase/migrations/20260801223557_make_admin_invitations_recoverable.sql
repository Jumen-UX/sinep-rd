create or replace function app_private.admin_reconcile_user_invitation(
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_actor_id uuid := auth.uid();
  v_email text := lower(nullif(btrim(payload->>'email'), ''));
  v_full_name text := nullif(btrim(payload->>'full_name'), '');
  v_phone text := nullif(btrim(payload->>'phone'), '');
  v_user_id_hint uuid := nullif(payload->>'user_id_hint', '')::uuid;
  v_country_entity_id uuid := nullif(payload->>'country_entity_id', '')::uuid;
  v_role_id uuid := nullif(payload->>'role_id', '')::uuid;
  v_role_key text := nullif(btrim(payload->>'role_key'), '');
  v_scope_type text := coalesce(nullif(btrim(payload->>'scope_type'), ''), 'national');
  v_scope_entity_id uuid := nullif(payload->>'scope_entity_id', '')::uuid;
  v_user_id uuid;
  v_profile_existed boolean;
  v_membership jsonb;
  v_assignment jsonb := null;
begin
  if v_actor_id is null or not (
    app_private.current_user_has_permission('users.manage')
    or app_private.current_user_has_role(array['super_admin'])
  ) then
    raise exception 'No autorizado para reconciliar invitaciones.' using errcode = '42501';
  end if;

  if v_email is null
    or length(v_email) > 320
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Correo de invitación no válido.' using errcode = '22023';
  end if;

  if v_country_entity_id is null then
    raise exception 'Debes seleccionar el país administrativo.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('admin-user-invitation:' || v_email, 0)
  );

  select auth_user.id
  into v_user_id
  from auth.users auth_user
  where lower(auth_user.email) = v_email
    and (v_user_id_hint is null or auth_user.id = v_user_id_hint)
  order by auth_user.created_at
  limit 1;

  if v_user_id is null then
    raise exception 'La cuenta todavía no existe en Supabase Auth; reintenta la invitación.'
      using errcode = '22023';
  end if;

  select exists (
    select 1 from public.profiles profile_row where profile_row.id = v_user_id
  ) into v_profile_existed;

  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    status,
    onboarding_step,
    onboarding_completed_at
  ) values (
    v_user_id,
    v_email,
    coalesce(v_full_name, v_email),
    v_phone,
    'pending_invitation',
    'profile',
    null
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(v_full_name, nullif(public.profiles.full_name, ''), v_email),
      phone = coalesce(v_phone, public.profiles.phone),
      updated_at = now();

  v_membership := app_private.admin_register_user_country_membership(
    jsonb_build_object(
      'user_id', v_user_id,
      'country_entity_id', v_country_entity_id,
      'source_type', 'invitation'
    )
  );

  if v_role_id is not null or v_role_key is not null then
    v_assignment := app_private.admin_assign_user_role(
      jsonb_strip_nulls(jsonb_build_object(
        'user_id', v_user_id,
        'role_id', v_role_id,
        'role_key', v_role_key,
        'scope_type', v_scope_type,
        'scope_entity_id', v_scope_entity_id
      ))
    );
  end if;

  return jsonb_build_object(
    'user_id', v_user_id,
    'email', v_email,
    'profile_existed', v_profile_existed,
    'membership', v_membership,
    'assignment', v_assignment
  );
end;
$$;

create or replace function app_private.rpc_definer__admin_reconcile_user_invitation(
  payload jsonb
)
returns jsonb
language sql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.admin_reconcile_user_invitation(payload);
$$;

create or replace function public.admin_reconcile_user_invitation(
  payload jsonb
)
returns jsonb
language sql
security invoker
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.rpc_definer__admin_reconcile_user_invitation(payload);
$$;

revoke all on function app_private.admin_reconcile_user_invitation(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.rpc_definer__admin_reconcile_user_invitation(jsonb)
  from public, anon, authenticated;
revoke all on function public.admin_reconcile_user_invitation(jsonb)
  from public, anon;
grant execute on function public.admin_reconcile_user_invitation(jsonb)
  to authenticated;

comment on function public.admin_reconcile_user_invitation(jsonb) is
  'Repara de forma idempotente perfil, país y rol después de crear o reencontrar una cuenta en Auth.';

do $$
begin
  if has_function_privilege(
    'anon',
    'public.admin_reconcile_user_invitation(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'La reconciliación de invitaciones es ejecutable por anon';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.admin_reconcile_user_invitation(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'La reconciliación de invitaciones no está disponible para administradores';
  end if;
end;
$$;
