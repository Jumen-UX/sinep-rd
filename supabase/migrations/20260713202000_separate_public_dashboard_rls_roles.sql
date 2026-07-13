alter policy public_dashboard_office_base_roles_select
  on public.office_base_roles
  to anon;

alter policy public_dashboard_office_categories_select
  on public.office_categories
  to anon;

alter policy public_dashboard_office_configurations_select
  on public.office_configurations
  to anon;

alter policy public_dashboard_office_scopes_select
  on public.office_scopes
  to anon;

alter policy public_dashboard_organization_charts_select
  on public.organization_charts
  to anon;

alter policy public_dashboard_organization_units_select
  on public.organization_units
  to anon;

alter policy public_dashboard_position_assignments_select
  on public.position_assignments
  to anon;
