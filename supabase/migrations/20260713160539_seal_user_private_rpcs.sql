create or replace function public.admin_assign_user_role(payload jsonb)
returns jsonb
language sql
security definer
set search_path = 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.admin_assign_user_role(payload);
$$;

create or replace function public.admin_end_user_role(payload jsonb)
returns jsonb
language sql
security definer
set search_path = 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.admin_end_user_role(payload);
$$;

create or replace function public.admin_update_user_profile_status(payload jsonb)
returns jsonb
language sql
security definer
set search_path = 'public', 'app_private', 'auth', 'pg_temp'
as $$
  select app_private.admin_update_user_profile_status(payload);
$$;

revoke all on function app_private.admin_assign_user_role(jsonb) from public, anon, authenticated;
revoke all on function app_private.admin_end_user_role(jsonb) from public, anon, authenticated;
revoke all on function app_private.admin_update_user_profile_status(jsonb) from public, anon, authenticated;

grant execute on function public.admin_assign_user_role(jsonb) to authenticated, service_role;
grant execute on function public.admin_end_user_role(jsonb) to authenticated, service_role;
grant execute on function public.admin_update_user_profile_status(jsonb) to authenticated, service_role;
