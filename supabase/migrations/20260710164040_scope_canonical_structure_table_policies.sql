drop policy if exists structure_templates_insert_admin on public.structure_templates;
drop policy if exists structure_templates_update_admin on public.structure_templates;
drop policy if exists structure_templates_remove_admin on public.structure_templates;
create policy structure_templates_insert_scoped
on public.structure_templates for insert to authenticated
with check (app_private.current_user_can_manage_entity('structures.manage', diocese_id));
create policy structure_templates_update_scoped
on public.structure_templates for update to authenticated
using (app_private.current_user_can_manage_entity('structures.manage', diocese_id))
with check (app_private.current_user_can_manage_entity('structures.manage', diocese_id));
create policy structure_templates_delete_scoped
on public.structure_templates for delete to authenticated
using (app_private.current_user_can_manage_entity('structures.manage', diocese_id));

drop policy if exists structure_levels_insert_admin on public.structure_levels;
drop policy if exists structure_levels_update_admin on public.structure_levels;
drop policy if exists structure_levels_remove_admin on public.structure_levels;
create policy structure_levels_insert_scoped
on public.structure_levels for insert to authenticated
with check (app_private.structure_template_in_scope(template_id));
create policy structure_levels_update_scoped
on public.structure_levels for update to authenticated
using (app_private.structure_template_in_scope(template_id))
with check (app_private.structure_template_in_scope(template_id));
create policy structure_levels_delete_scoped
on public.structure_levels for delete to authenticated
using (app_private.structure_template_in_scope(template_id));

drop policy if exists structure_level_edges_insert_admin on public.structure_level_edges;
drop policy if exists structure_level_edges_update_admin on public.structure_level_edges;
drop policy if exists structure_level_edges_remove_admin on public.structure_level_edges;
create policy structure_level_edges_insert_scoped
on public.structure_level_edges for insert to authenticated
with check (app_private.structure_template_in_scope(template_id));
create policy structure_level_edges_update_scoped
on public.structure_level_edges for update to authenticated
using (app_private.structure_template_in_scope(template_id))
with check (app_private.structure_template_in_scope(template_id));
create policy structure_level_edges_delete_scoped
on public.structure_level_edges for delete to authenticated
using (app_private.structure_template_in_scope(template_id));

drop policy if exists structure_nodes_insert_admin on public.structure_nodes;
drop policy if exists structure_nodes_update_admin on public.structure_nodes;
drop policy if exists structure_nodes_remove_admin on public.structure_nodes;
create policy structure_nodes_insert_scoped
on public.structure_nodes for insert to authenticated
with check (app_private.current_user_can_manage_entity('structures.manage', diocese_id));
create policy structure_nodes_update_scoped
on public.structure_nodes for update to authenticated
using (app_private.current_user_can_manage_entity('structures.manage', diocese_id))
with check (app_private.current_user_can_manage_entity('structures.manage', diocese_id));
create policy structure_nodes_delete_scoped
on public.structure_nodes for delete to authenticated
using (app_private.current_user_can_manage_entity('structures.manage', diocese_id));

drop policy if exists structure_node_edges_insert_admin on public.structure_node_edges;
drop policy if exists structure_node_edges_update_admin on public.structure_node_edges;
drop policy if exists structure_node_edges_remove_admin on public.structure_node_edges;
create policy structure_node_edges_insert_scoped
on public.structure_node_edges for insert to authenticated
with check (app_private.structure_template_in_scope(template_id));
create policy structure_node_edges_update_scoped
on public.structure_node_edges for update to authenticated
using (app_private.structure_template_in_scope(template_id))
with check (app_private.structure_template_in_scope(template_id));
create policy structure_node_edges_delete_scoped
on public.structure_node_edges for delete to authenticated
using (app_private.structure_template_in_scope(template_id));
