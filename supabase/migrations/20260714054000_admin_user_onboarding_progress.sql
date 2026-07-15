create or replace function app_private.admin_list_user_onboarding_progress()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
stable
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not (
    app_private.current_user_has_permission('users.manage')
    or app_private.current_user_is_super_or_national()
  ) then
    raise exception 'No autorizado para listar el avance de acceso' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', u.id,
    'onboarding_step', coalesce(p.onboarding_step, 'profile'),
    'onboarding_completed_at', p.onboarding_completed_at,
    'access_state', case
      when p.status in ('suspended', 'inactive') then 'blocked'
      when p.onboarding_completed_at is null then 'onboarding'
      when not exists (
        select 1
        from public.user_role_assignments ura
        where ura.user_id = u.id
          and ura.status = 'active'
          and (ura.starts_at is null or ura.starts_at <= current_date)
          and (ura.ends_at is null or ura.ends_at >= current_date)
      ) then 'no_role'
      else 'ready'
    end
  ) order by u.created_at desc), '[]'::jsonb)
  into v_result
  from auth.users u
  left join public.profiles p on p.id = u.id;

  return v_result;
end;
$function$;

create or replace function public.admin_list_user_onboarding_progress()
returns jsonb
language sql
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
stable
as $function$
  select app_private.admin_list_user_onboarding_progress();
$function$;

revoke all on function app_private.admin_list_user_onboarding_progress() from public, anon, authenticated;
revoke all on function public.admin_list_user_onboarding_progress() from public, anon;
grant execute on function app_private.admin_list_user_onboarding_progress() to service_role;
grant execute on function public.admin_list_user_onboarding_progress() to authenticated, service_role;

notify pgrst, 'reload schema';
