-- Phase 0 adjustment: avoid SECURITY DEFINER helpers in the exposed public schema.
--
-- Supabase Advisor flags public SECURITY DEFINER functions executable by anon
-- or authenticated roles because they are reachable through /rest/v1/rpc/*.
-- Final state: public authorization helpers remain SECURITY INVOKER wrappers.

begin;

alter function public.can_view_visibility(text)
  security invoker
  set search_path = public, app_private, auth, pg_temp;

alter function public.current_user_has_any_active_role()
  security invoker
  set search_path = public, app_private, auth, pg_temp;

alter function public.current_user_has_permission(text)
  security invoker
  set search_path = public, app_private, auth, pg_temp;

alter function public.current_user_has_role(text[])
  security invoker
  set search_path = public, app_private, auth, pg_temp;

alter function public.current_user_is_admin()
  security invoker
  set search_path = public, app_private, auth, pg_temp;

alter function public.current_user_is_super_or_national()
  security invoker
  set search_path = public, app_private, auth, pg_temp;

-- Required by SECURITY INVOKER public wrappers currently referenced by RLS.
-- The long-term refactor should move helpers out of exposed schemas and update
-- policies to call the private/internal helper surface directly.
grant usage on schema app_private to anon, authenticated;
grant execute on all functions in schema app_private to anon, authenticated;

grant execute on function public.can_view_visibility(text) to anon, authenticated;
grant execute on function public.current_user_has_any_active_role() to anon, authenticated;
grant execute on function public.current_user_has_permission(text) to anon, authenticated;
grant execute on function public.current_user_has_role(text[]) to anon, authenticated;
grant execute on function public.current_user_is_admin() to anon, authenticated;
grant execute on function public.current_user_is_super_or_national() to anon, authenticated;

commit;
