create or replace function app_private.get_my_admin_entry_context()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
stable
as $function$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_has_admin_role boolean := false;
  v_access_state text;
begin
  if v_user_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Perfil de acceso no encontrado' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = v_user_id
      and ura.status = 'active'
      and (ura.starts_at is null or ura.starts_at <= current_date)
      and (ura.ends_at is null or ura.ends_at >= current_date)
  ) into v_has_admin_role;

  v_access_state := case
    when v_profile.status in ('suspended', 'inactive') then 'blocked'
    when v_profile.onboarding_completed_at is null then 'onboarding'
    when not v_has_admin_role then 'no_role'
    else 'ready'
  end;

  return jsonb_build_object(
    'user_id', v_user_id,
    'email', v_profile.email,
    'profile_status', v_profile.status,
    'onboarding_completed_at', v_profile.onboarding_completed_at,
    'has_admin_role', v_has_admin_role,
    'access_state', v_access_state
  );
end;
$function$;

create or replace function public.get_my_admin_entry_context()
returns jsonb
language sql
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
stable
as $function$
  select app_private.get_my_admin_entry_context();
$function$;

revoke all on function app_private.get_my_admin_entry_context() from public, anon, authenticated;
revoke all on function public.get_my_admin_entry_context() from public, anon;
grant execute on function public.get_my_admin_entry_context() to authenticated, service_role;
