-- Fix public dashboard REST access for anon role while preserving RLS boundaries.
-- The public dashboard reads security_invoker views and a few public catalog tables.
-- Therefore anon needs SELECT privileges plus restrictive SELECT policies on the involved RLS tables.

-- Public views exposed to the frontend/API.
grant select on table
  public.public_countries,
  public.public_pastoral_entities,
  public.public_position_assignments,
  public.public_position_assignments_with_hierarchy,
  public.public_entity_hierarchy_paths
  to anon, authenticated;

-- Base tables used by security_invoker public views and direct public dashboard reads.
grant select on table
  public.countries,
  public.ecclesiastical_entities,
  public.entity_types,
  public.entity_relationships,
  public.pastoral_areas,
  public.pastoral_entities,
  public.pastoral_structure_levels,
  public.persons,
  public.position_assignments,
  public.office_configurations,
  public.office_base_roles,
  public.office_scopes,
  public.office_categories,
  public.organization_charts,
  public.organization_units
  to anon, authenticated;

-- Countries: visible only when explicitly public and active.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'countries'
      and policyname = 'public_dashboard_countries_select'
  ) then
    create policy public_dashboard_countries_select
      on public.countries
      for select
      to anon, authenticated
      using (status = 'active' and visibility = 'public');
  end if;
end $$;

-- Direct organization chart queries from the public dashboard.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organization_charts'
      and policyname = 'public_dashboard_organization_charts_select'
  ) then
    create policy public_dashboard_organization_charts_select
      on public.organization_charts
      for select
      to anon, authenticated
      using (status = 'active' and visibility = 'public');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organization_units'
      and policyname = 'public_dashboard_organization_units_select'
  ) then
    create policy public_dashboard_organization_units_select
      on public.organization_units
      for select
      to anon, authenticated
      using (status = 'active' and visibility = 'public');
  end if;
end $$;

-- Office catalogs needed by public assignment views.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'office_base_roles'
      and policyname = 'public_dashboard_office_base_roles_select'
  ) then
    create policy public_dashboard_office_base_roles_select
      on public.office_base_roles
      for select
      to anon, authenticated
      using (status = 'active');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'office_categories'
      and policyname = 'public_dashboard_office_categories_select'
  ) then
    create policy public_dashboard_office_categories_select
      on public.office_categories
      for select
      to anon, authenticated
      using (status = 'active');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'office_scopes'
      and policyname = 'public_dashboard_office_scopes_select'
  ) then
    create policy public_dashboard_office_scopes_select
      on public.office_scopes
      for select
      to anon, authenticated
      using (status = 'active');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'office_configurations'
      and policyname = 'public_dashboard_office_configurations_select'
  ) then
    create policy public_dashboard_office_configurations_select
      on public.office_configurations
      for select
      to anon, authenticated
      using (status = 'active' and visibility = 'public');
  end if;
end $$;

-- Public assignments: expose only published, public, active records in their public window.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'position_assignments'
      and policyname = 'public_dashboard_position_assignments_select'
  ) then
    create policy public_dashboard_position_assignments_select
      on public.position_assignments
      for select
      to anon, authenticated
      using (
        record_status = 'active'
        and visibility = 'public'
        and publication_status = 'published'
        and coalesce(public_from, start_date, term_start_date, current_date) <= current_date
        and (public_until is null or public_until >= current_date)
      );
  end if;
end $$;
