alter function public.admin_review_queue(jsonb) security definer;
alter function public.admin_review_queue(jsonb) set search_path = public, app_private, auth, pg_temp;
revoke all on function app_private.admin_review_queue(jsonb) from public, anon, authenticated;
grant execute on function public.admin_review_queue(jsonb) to authenticated, service_role;
