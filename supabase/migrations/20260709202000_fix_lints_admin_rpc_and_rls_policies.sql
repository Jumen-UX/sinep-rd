-- Fix Supabase security lints that can be corrected safely without breaking admin flows.
-- 1) Fix mutable search_path.
-- 2) Remove anonymous EXECUTE access from SECURITY DEFINER admin/import functions.
-- 3) Add explicit RLS policies to RLS-enabled tables that had no policies.

-- 1) Function search path lint.
alter function public.add_honorific_to_semicolon_list(value text, prefix text)
  set search_path = public, pg_temp;

-- 2) SECURITY DEFINER functions must not be callable by anon.
-- Revoke PUBLIC first because anon can inherit EXECUTE from PUBLIC.
revoke execute on function public.admin_imported_appointment_review_summary() from public;
revoke execute on function public.admin_list_imported_appointment_review(p_state text, p_search text, p_limit integer, p_offset integer) from public;
revoke execute on function public.admin_review_imported_appointment(payload jsonb) from public;
revoke execute on function public.admin_review_queue(payload jsonb) from public;
revoke execute on function public.enable_country_from_catalog(p_iso2 text, p_flag_image_url text) from public;
revoke execute on function public.import_sto_dgo_parish_directory_rows(payload jsonb) from public;
revoke execute on function public.import_sto_dgo_parish_person_candidates(payload jsonb) from public;
revoke execute on function public.position_assignments_close_previous_current() from public;

revoke execute on function public.admin_imported_appointment_review_summary() from anon;
revoke execute on function public.admin_list_imported_appointment_review(p_state text, p_search text, p_limit integer, p_offset integer) from anon;
revoke execute on function public.admin_review_imported_appointment(payload jsonb) from anon;
revoke execute on function public.admin_review_queue(payload jsonb) from anon;
revoke execute on function public.enable_country_from_catalog(p_iso2 text, p_flag_image_url text) from anon;
revoke execute on function public.import_sto_dgo_parish_directory_rows(payload jsonb) from anon;
revoke execute on function public.import_sto_dgo_parish_person_candidates(payload jsonb) from anon;
revoke execute on function public.position_assignments_close_previous_current() from anon;

-- Keep authenticated access for current admin UI/RPC flows, except the trigger-only function.
grant execute on function public.admin_imported_appointment_review_summary() to authenticated;
grant execute on function public.admin_list_imported_appointment_review(p_state text, p_search text, p_limit integer, p_offset integer) to authenticated;
grant execute on function public.admin_review_imported_appointment(payload jsonb) to authenticated;
grant execute on function public.admin_review_queue(payload jsonb) to authenticated;
grant execute on function public.enable_country_from_catalog(p_iso2 text, p_flag_image_url text) to authenticated;
grant execute on function public.import_sto_dgo_parish_directory_rows(payload jsonb) to authenticated;
grant execute on function public.import_sto_dgo_parish_person_candidates(payload jsonb) to authenticated;
revoke execute on function public.position_assignments_close_previous_current() from authenticated;

-- 3) RLS policies for country catalog and import/staging tables.
-- Country catalog is non-sensitive ISO/reference data.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'country_catalog'
      and policyname = 'country_catalog_select_public'
  ) then
    create policy country_catalog_select_public
      on public.country_catalog
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

-- Admin-only import/staging review tables.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'import_clergy_directory_review'
      and policyname = 'import_clergy_directory_review_admin_all'
  ) then
    create policy import_clergy_directory_review_admin_all
      on public.import_clergy_directory_review
      for all
      to authenticated
      using (current_user_has_admin_role())
      with check (current_user_has_admin_role());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'import_parish_directory_person_candidates_sto_dgo_2026'
      and policyname = 'import_parish_person_candidates_sto_dgo_2026_admin_all'
  ) then
    create policy import_parish_person_candidates_sto_dgo_2026_admin_all
      on public.import_parish_directory_person_candidates_sto_dgo_2026
      for all
      to authenticated
      using (current_user_has_admin_role())
      with check (current_user_has_admin_role());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'import_parish_directory_staging'
      and policyname = 'import_parish_directory_staging_admin_all'
  ) then
    create policy import_parish_directory_staging_admin_all
      on public.import_parish_directory_staging
      for all
      to authenticated
      using (current_user_has_admin_role())
      with check (current_user_has_admin_role());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'import_parish_directory_sto_dgo_2026'
      and policyname = 'import_parish_directory_sto_dgo_2026_admin_all'
  ) then
    create policy import_parish_directory_sto_dgo_2026_admin_all
      on public.import_parish_directory_sto_dgo_2026
      for all
      to authenticated
      using (current_user_has_admin_role())
      with check (current_user_has_admin_role());
  end if;
end $$;
