begin;

create or replace function app_private.current_user_can_read_organization_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.organization_units unit_row
    where unit_row.id = p_unit_id
      and (
        (unit_row.status = 'active' and unit_row.visibility = 'public')
        or app_private.current_user_can_manage_entity('pastorals.view', unit_row.ecclesiastical_entity_id)
      )
  );
$$;

create or replace function app_private.current_user_can_read_organization_chart(p_chart_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.organization_charts chart_row
    where chart_row.id = p_chart_id
      and (
        (chart_row.status = 'active' and chart_row.visibility in ('public', 'authenticated'))
        or app_private.current_user_has_permission('pastorals.view')
      )
  );
$$;

create or replace function app_private.current_user_can_read_structure_template(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.structure_templates template_row
    where template_row.id = p_template_id
      and (
        template_row.status = 'active'
        or (
          auth.uid() is not null
          and app_private.current_user_can_manage_entity('structures.manage', template_row.diocese_id)
        )
      )
  );
$$;

create or replace function app_private.current_user_can_read_structure_level(p_level_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.structure_levels level_row
    where level_row.id = p_level_id
      and app_private.current_user_can_read_structure_template(level_row.template_id)
  );
$$;

create or replace function app_private.current_user_can_read_structure_edge(p_edge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.structure_node_edges edge_row
    where edge_row.id = p_edge_id
      and app_private.current_user_can_read_structure_node(edge_row.parent_node_id)
      and app_private.current_user_can_read_structure_node(edge_row.child_node_id)
  );
$$;

revoke all on function app_private.current_user_can_read_organization_unit(uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_read_organization_chart(uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_read_structure_template(uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_read_structure_level(uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_read_structure_edge(uuid) from public, anon, authenticated;

grant execute on function app_private.current_user_can_read_organization_unit(uuid) to authenticated;
grant execute on function app_private.current_user_can_read_organization_chart(uuid) to authenticated;
grant execute on function app_private.current_user_can_read_structure_template(uuid) to anon, authenticated;
grant execute on function app_private.current_user_can_read_structure_level(uuid) to anon, authenticated;
grant execute on function app_private.current_user_can_read_structure_node(uuid) to anon, authenticated;
grant execute on function app_private.current_user_can_read_structure_edge(uuid) to anon, authenticated;

drop policy if exists organization_units_select_authenticated on public.organization_units;
create policy organization_units_select_authenticated
on public.organization_units
for select
to authenticated
using (app_private.current_user_can_read_organization_unit(id));

drop policy if exists organization_charts_select_authenticated on public.organization_charts;
create policy organization_charts_select_authenticated
on public.organization_charts
for select
to authenticated
using (app_private.current_user_can_read_organization_chart(id));

drop policy if exists structure_templates_select_public on public.structure_templates;
create policy structure_templates_select_public
on public.structure_templates
for select
to public
using (app_private.current_user_can_read_structure_template(id));

drop policy if exists structure_levels_select_public on public.structure_levels;
create policy structure_levels_select_public
on public.structure_levels
for select
to public
using (app_private.current_user_can_read_structure_level(id));

drop policy if exists structure_nodes_select_public on public.structure_nodes;
create policy structure_nodes_select_public
on public.structure_nodes
for select
to public
using (app_private.current_user_can_read_structure_node(id));

drop policy if exists structure_node_edges_select_public on public.structure_node_edges;
create policy structure_node_edges_select_public
on public.structure_node_edges
for select
to public
using (app_private.current_user_can_read_structure_edge(id));

grant execute on function app_private.rpc_definer__get_structure_node_detail(uuid) to authenticated;
grant execute on function app_private.rpc_definer__admin_save_organization_unit(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_save_structure_template(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_save_structure_level(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_save_structure_node(jsonb) to authenticated;
grant execute on function app_private.rpc_definer__admin_apply_organization_unit_event(jsonb) to authenticated;

comment on function app_private.current_user_can_read_organization_unit(uuid) is
  'Policy-safe row reader. Public active units are visible; internal rows require pastorals.view within territorial scope.';

commit;
