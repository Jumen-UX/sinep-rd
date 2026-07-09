-- Supabase linter fix: public API views must run with caller permissions.
-- This prevents SECURITY DEFINER behavior and makes RLS/permissions evaluate as anon/authenticated.

alter view public.public_dioceses set (security_invoker = true);
alter view public.public_position_assignments set (security_invoker = true);

grant select on table
  public.public_dioceses,
  public.public_position_assignments
  to anon, authenticated;
