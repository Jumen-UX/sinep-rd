alter table public.profiles
  add column if not exists onboarding_step text not null default 'profile',
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_updated_at timestamptz not null default now();

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_onboarding_step_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_onboarding_step_check
      check (onboarding_step in ('profile', 'access', 'complete'));
  end if;
end;
$migration$;

update public.profiles
set onboarding_step = 'complete',
    onboarding_completed_at = coalesce(onboarding_completed_at, updated_at, now()),
    onboarding_updated_at = now()
where status = 'active'
  and onboarding_completed_at is null;

create or replace function app_private.get_my_onboarding_context()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
stable
as $function$
declare
  v_user_id uuid := auth.uid();
  v_context jsonb;
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'user_id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'phone', p.phone,
    'profile_status', p.status,
    'onboarding_step', p.onboarding_step,
    'onboarding_completed_at', p.onboarding_completed_at,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assignment_id', ura.id,
        'role_key', r.key,
        'role_name', r.name,
        'scope_type', ura.scope_type,
        'scope_entity_id', ura.scope_entity_id,
        'scope_label', coalesce(ee.name, ou.name, ura.scope_type)
      ) order by r.name)
      from public.user_role_assignments ura
      join public.roles r on r.id = ura.role_id
      left join public.ecclesiastical_entities ee on ee.id = ura.scope_entity_id
      left join public.organization_units ou on ou.id = ura.scope_entity_id
      where ura.user_id = p.id
        and ura.status = 'active'
        and (ura.starts_at is null or ura.starts_at <= now())
        and (ura.ends_at is null or ura.ends_at >= now())
    ), '[]'::jsonb)
  )
  into v_context
  from public.profiles p
  where p.id = v_user_id;

  if v_context is null then
    raise exception 'Perfil de acceso no encontrado' using errcode = '22023';
  end if;

  return v_context;
end;
$function$;

create or replace function app_private.save_my_onboarding(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_full_name text := nullif(btrim(payload->>'full_name'), '');
  v_phone text := nullif(btrim(payload->>'phone'), '');
  v_complete boolean := coalesce((payload->>'complete')::boolean, false);
  v_has_role boolean := false;
  v_old_profile public.profiles%rowtype;
  v_step text;
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if v_full_name is null or char_length(v_full_name) > 180 then
    raise exception 'El nombre completo es obligatorio y no puede superar 180 caracteres' using errcode = '22023';
  end if;

  if v_phone is not null and char_length(v_phone) > 80 then
    raise exception 'El teléfono no puede superar 80 caracteres' using errcode = '22023';
  end if;

  select * into v_old_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Perfil de acceso no encontrado' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = v_user_id
      and ura.status = 'active'
      and (ura.starts_at is null or ura.starts_at <= now())
      and (ura.ends_at is null or ura.ends_at >= now())
  ) into v_has_role;

  if v_complete and not v_has_role then
    raise exception 'Tu cuenta todavía no tiene un rol y alcance activos' using errcode = '42501';
  end if;

  v_step := case when v_complete then 'complete' else 'access' end;

  update public.profiles
  set full_name = v_full_name,
      phone = v_phone,
      status = case when v_complete and status = 'pending_invitation' then 'active' else status end,
      onboarding_step = v_step,
      onboarding_completed_at = case when v_complete then coalesce(onboarding_completed_at, now()) else onboarding_completed_at end,
      onboarding_updated_at = now(),
      updated_at = now()
  where id = v_user_id;

  if v_complete and v_old_profile.onboarding_completed_at is null then
    insert into public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
    values (
      v_user_id,
      'users.complete_onboarding',
      'profiles',
      v_user_id,
      jsonb_build_object(
        'status', v_old_profile.status,
        'onboarding_step', v_old_profile.onboarding_step
      ),
      jsonb_build_object(
        'status', case when v_old_profile.status = 'pending_invitation' then 'active' else v_old_profile.status end,
        'onboarding_step', 'complete'
      )
    );
  end if;

  return app_private.get_my_onboarding_context();
end;
$function$;

create or replace function public.get_my_onboarding_context()
returns jsonb
language sql
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
stable
as $function$
  select app_private.get_my_onboarding_context();
$function$;

create or replace function public.save_my_onboarding(payload jsonb)
returns jsonb
language sql
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.save_my_onboarding(payload);
$function$;

revoke all on function app_private.get_my_onboarding_context() from public, anon, authenticated;
revoke all on function app_private.save_my_onboarding(jsonb) from public, anon, authenticated;
revoke all on function public.get_my_onboarding_context() from public, anon;
revoke all on function public.save_my_onboarding(jsonb) from public, anon;

grant execute on function public.get_my_onboarding_context() to authenticated, service_role;
grant execute on function public.save_my_onboarding(jsonb) to authenticated, service_role;

