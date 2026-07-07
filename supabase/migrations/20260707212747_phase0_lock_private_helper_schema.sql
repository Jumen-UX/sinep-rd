-- Phase 0: first pass to harden private helper schema access.
--
-- This migration was applied during the security audit but was immediately
-- followed by 20260707212938_phase0_restore_invoker_rls_helpers.sql after
-- Supabase Advisor correctly flagged exposed SECURITY DEFINER wrappers.
-- Keep both files because both migration versions exist in Supabase history.

begin;

alter function public.can_view_visibility(text)
  security definer
  set search_path = public, app_private, auth, pg_temp;

alter function public.current_user_has_any_active_role()
  security definer
  set search_path = public, app_private, auth, pg_temp;

alter function public.current_user_has_permission(text)
  security definer
  set search_path = public, app_private, auth, pg_temp;

alter function public.current_user_has_role(text[])
  security definer
  set search_path = public, app_private, auth, pg_temp;

alter function public.current_user_is_admin()
  security definer
  set search_path = public, app_private, auth, pg_temp;

alter function public.current_user_is_super_or_national()
  security definer
  set search_path = public, app_private, auth, pg_temp;

revoke usage on schema app_private from anon, authenticated;
revoke execute on all functions in schema app_private from anon, authenticated;

grant execute on function public.can_view_visibility(text) to anon, authenticated;
grant execute on function public.current_user_has_any_active_role() to anon, authenticated;
grant execute on function public.current_user_has_permission(text) to anon, authenticated;
grant execute on function public.current_user_has_role(text[]) to anon, authenticated;
grant execute on function public.current_user_is_admin() to anon, authenticated;
grant execute on function public.current_user_is_super_or_national() to anon, authenticated;

commit;
