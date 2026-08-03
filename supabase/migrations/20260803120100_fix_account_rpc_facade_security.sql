-- Public account RPCs must cross the sealed app_private boundary with owner privileges.
-- Anonymous execution remains revoked; each implementation validates auth.uid().

create or replace function public.get_my_account_context()
returns jsonb
language sql
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
stable
as $function$
  select app_private.get_my_account_context();
$function$;

create or replace function public.save_my_account_profile(payload jsonb)
returns jsonb
language sql
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.save_my_account_profile(payload);
$function$;

create or replace function public.submit_my_access_request(payload jsonb)
returns jsonb
language sql
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.submit_my_access_request(payload);
$function$;

create or replace function public.cancel_my_access_request(p_request_id uuid)
returns jsonb
language sql
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.cancel_my_access_request(p_request_id);
$function$;

create or replace function public.admin_review_access_request(payload jsonb)
returns jsonb
language sql
security definer
set search_path to 'public', 'app_private', 'auth', 'pg_temp'
as $function$
  select app_private.admin_review_access_request(payload);
$function$;

revoke all on function public.get_my_account_context() from public, anon;
revoke all on function public.save_my_account_profile(jsonb) from public, anon;
revoke all on function public.submit_my_access_request(jsonb) from public, anon;
revoke all on function public.cancel_my_access_request(uuid) from public, anon;
revoke all on function public.admin_review_access_request(jsonb) from public, anon;

grant execute on function public.get_my_account_context() to authenticated, service_role;
grant execute on function public.save_my_account_profile(jsonb) to authenticated, service_role;
grant execute on function public.submit_my_access_request(jsonb) to authenticated, service_role;
grant execute on function public.cancel_my_access_request(uuid) to authenticated, service_role;
grant execute on function public.admin_review_access_request(jsonb) to authenticated, service_role;
