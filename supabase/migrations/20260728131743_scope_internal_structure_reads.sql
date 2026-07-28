begin;

create or replace function app_private.current_user_has_structure_node_scope(p_node_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.structure_nodes node_row
    left join public.organization_units unit_row
      on unit_row.id = node_row.linked_organization_unit_id
    where node_row.id = p_node_id
      and (
        app_private.current_user_can_manage_entity('structures.manage', node_row.diocese_id)
        or app_private.current_user_can_manage_entity(
          'entities.view',
          coalesce(node_row.linked_ecclesiastical_entity_id, unit_row.ecclesiastical_entity_id, node_row.diocese_id)
        )
        or (
          unit_row.ecclesiastical_entity_id is not null
          and app_private.current_user_can_manage_entity('pastorals.view', unit_row.ecclesiastical_entity_id)
        )
      )
  );
$$;

create or replace function app_private.current_user_can_read_structure_node(p_node_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.structure_nodes node_row
    where node_row.id = p_node_id
      and (
        node_row.visibility = 'public'
        or (
          auth.uid() is not null
          and app_private.current_user_has_structure_node_scope(node_row.id)
        )
      )
  );
$$;

revoke all on function app_private.current_user_has_structure_node_scope(uuid) from public, anon, authenticated;
revoke all on function app_private.current_user_can_read_structure_node(uuid) from public, anon, authenticated;

drop policy if exists organization_units_select_authenticated on public.organization_units;
create policy organization_units_select_authenticated
on public.organization_units
for select
to authenticated
using (
  (status = 'active' and visibility = 'public')
  or app_private.current_user_can_manage_entity('pastorals.view', ecclesiastical_entity_id)
);

drop policy if exists organization_charts_select_authenticated on public.organization_charts;
create policy organization_charts_select_authenticated
on public.organization_charts
for select
to authenticated
using (
  (status = 'active' and visibility in ('public', 'authenticated'))
  or app_private.current_user_has_permission('pastorals.view')
);

drop policy if exists structure_templates_select_public on public.structure_templates;
create policy structure_templates_select_public
on public.structure_templates
for select
to public
using (
  status = 'active'
  or (
    auth.uid() is not null
    and app_private.current_user_can_manage_entity('structures.manage', diocese_id)
  )
);

drop policy if exists structure_levels_select_public on public.structure_levels;
create policy structure_levels_select_public
on public.structure_levels
for select
to public
using (
  exists (
    select 1
    from public.structure_templates template_row
    where template_row.id = structure_levels.template_id
      and (
        template_row.status = 'active'
        or (
          auth.uid() is not null
          and app_private.current_user_can_manage_entity('structures.manage', template_row.diocese_id)
        )
      )
  )
);

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
using (
  app_private.current_user_can_read_structure_node(child_node_id)
  and app_private.current_user_can_read_structure_node(parent_node_id)
);

alter function app_private.rpc_definer__get_structure_node_detail(uuid)
rename to rpc_definer__get_structure_node_detail_unscoped;

revoke all on function app_private.rpc_definer__get_structure_node_detail_unscoped(uuid)
from public, anon, authenticated;

create function app_private.rpc_definer__get_structure_node_detail(p_node_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app_private, internal, auth, pg_temp
as $$
begin
  if auth.uid() is null
     or not app_private.current_user_has_structure_node_scope(p_node_id) then
    raise exception 'Not authorized to view this structure node' using errcode = '42501';
  end if;

  return app_private.rpc_definer__get_structure_node_detail_unscoped(p_node_id);
end;
$$;

revoke all on function app_private.rpc_definer__get_structure_node_detail(uuid)
from public, anon, authenticated;

comment on function app_private.current_user_has_structure_node_scope(uuid) is
  'Checks internal structure-node visibility using effective entity, pastoral, or structure permissions within territorial scope.';

comment on policy organization_units_select_authenticated on public.organization_units is
  'Public active units remain visible; internal rows require pastorals.view within the unit ecclesiastical scope.';

commit;
