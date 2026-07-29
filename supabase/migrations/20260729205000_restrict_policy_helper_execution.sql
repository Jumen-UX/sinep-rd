begin;

-- Public structure reads must not require direct EXECUTE access to private helpers.
drop policy if exists structure_templates_select_public on public.structure_templates;
drop policy if exists structure_templates_select_anon_active on public.structure_templates;
drop policy if exists structure_templates_select_authenticated_scoped on public.structure_templates;
create policy structure_templates_select_anon_active
on public.structure_templates
for select
to anon
using (status = 'active');
create policy structure_templates_select_authenticated_scoped
on public.structure_templates
for select
to authenticated
using (app_private.current_user_can_read_structure_template(id));

drop policy if exists structure_levels_select_public on public.structure_levels;
drop policy if exists structure_levels_select_anon_active on public.structure_levels;
drop policy if exists structure_levels_select_authenticated_scoped on public.structure_levels;
create policy structure_levels_select_anon_active
on public.structure_levels
for select
to anon
using (
  exists (
    select 1
    from public.structure_templates template_row
    where template_row.id = structure_levels.template_id
      and template_row.status = 'active'
  )
);
create policy structure_levels_select_authenticated_scoped
on public.structure_levels
for select
to authenticated
using (app_private.current_user_can_read_structure_level(id));

drop policy if exists structure_nodes_select_public on public.structure_nodes;
drop policy if exists structure_nodes_select_anon_public on public.structure_nodes;
drop policy if exists structure_nodes_select_authenticated_scoped on public.structure_nodes;
create policy structure_nodes_select_anon_public
on public.structure_nodes
for select
to anon
using (visibility = 'public');
create policy structure_nodes_select_authenticated_scoped
on public.structure_nodes
for select
to authenticated
using (app_private.current_user_can_read_structure_node(id));

drop policy if exists structure_node_edges_select_public on public.structure_node_edges;
drop policy if exists structure_node_edges_select_anon_public on public.structure_node_edges;
drop policy if exists structure_node_edges_select_authenticated_scoped on public.structure_node_edges;
create policy structure_node_edges_select_anon_public
on public.structure_node_edges
for select
to anon
using (
  parent_node_id in (
    select node_row.id
    from public.structure_nodes node_row
    where node_row.visibility = 'public'
  )
  and child_node_id in (
    select node_row.id
    from public.structure_nodes node_row
    where node_row.visibility = 'public'
  )
);
create policy structure_node_edges_select_authenticated_scoped
on public.structure_node_edges
for select
to authenticated
using (app_private.current_user_can_read_structure_edge(id));

-- Public entity reads use direct publication predicates; scoped internal reads use private helpers.
drop policy if exists ecclesiastical_entities_select_scoped on public.ecclesiastical_entities;
drop policy if exists ecclesiastical_entities_select_anon_public on public.ecclesiastical_entities;
drop policy if exists ecclesiastical_entities_select_authenticated_scoped on public.ecclesiastical_entities;
create policy ecclesiastical_entities_select_anon_public
on public.ecclesiastical_entities
for select
to anon
using (status = 'active' and visibility = 'public');
create policy ecclesiastical_entities_select_authenticated_scoped
on public.ecclesiastical_entities
for select
to authenticated
using (app_private.current_user_can_read_entity(id));

drop policy if exists entity_relationships_select_scoped on public.entity_relationships;
drop policy if exists entity_relationships_select_anon_public on public.entity_relationships;
drop policy if exists entity_relationships_select_authenticated_scoped on public.entity_relationships;
create policy entity_relationships_select_anon_public
on public.entity_relationships
for select
to anon
using (
  status = 'active'
  and exists (
    select 1
    from public.ecclesiastical_entities parent_row
    where parent_row.id = parent_entity_id
      and parent_row.status = 'active'
      and parent_row.visibility = 'public'
  )
  and exists (
    select 1
    from public.ecclesiastical_entities child_row
    where child_row.id = child_entity_id
      and child_row.status = 'active'
      and child_row.visibility = 'public'
  )
);
create policy entity_relationships_select_authenticated_scoped
on public.entity_relationships
for select
to authenticated
using (app_private.current_user_can_read_entity_relationship(id));

-- Calendar publication and scoped administrative visibility are separate policies.
drop policy if exists event_occurrences_select_scoped on public.event_occurrences;
drop policy if exists event_occurrences_select_anon_public on public.event_occurrences;
drop policy if exists event_occurrences_select_authenticated_scoped on public.event_occurrences;
create policy event_occurrences_select_anon_public
on public.event_occurrences
for select
to anon
using (visibility = 'public' and status = 'active');
create policy event_occurrences_select_authenticated_scoped
on public.event_occurrences
for select
to authenticated
using (
  (visibility = 'public' and status = 'active')
  or app_private.current_user_can_view_calendar_record('event_occurrences', id, visibility)
);

drop policy if exists commemorative_events_select_scoped on public.commemorative_events;
drop policy if exists commemorative_events_select_anon_public on public.commemorative_events;
drop policy if exists commemorative_events_select_authenticated_scoped on public.commemorative_events;
create policy commemorative_events_select_anon_public
on public.commemorative_events
for select
to anon
using (visibility = 'public' and status in ('active', 'approved'));
create policy commemorative_events_select_authenticated_scoped
on public.commemorative_events
for select
to authenticated
using (
  (visibility = 'public' and status in ('active', 'approved'))
  or app_private.current_user_can_view_calendar_record('commemorative_events', id, visibility)
);

-- Private policy helpers are executable only by authenticated users that reach them through RLS.
revoke execute on function app_private.current_user_can_read_structure_template(uuid) from public, anon;
revoke execute on function app_private.current_user_can_read_structure_level(uuid) from public, anon;
revoke execute on function app_private.current_user_can_read_structure_node(uuid) from public, anon;
revoke execute on function app_private.current_user_can_read_structure_edge(uuid) from public, anon;
revoke execute on function app_private.current_user_can_read_entity(uuid) from public, anon;
revoke execute on function app_private.current_user_can_read_entity_relationship(uuid) from public, anon;
revoke execute on function app_private.current_user_can_read_canonical_event(uuid) from public, anon;
revoke execute on function app_private.current_user_can_read_person(uuid) from public, anon;
revoke execute on function app_private.current_user_can_read_position_assignment(uuid) from public, anon;
revoke execute on function app_private.current_user_can_view_calendar_record(text, uuid, text) from public, anon;
revoke execute on function app_private.current_user_can_view_document(uuid, text, text) from public, anon;

grant execute on function app_private.current_user_can_read_structure_template(uuid) to authenticated;
grant execute on function app_private.current_user_can_read_structure_level(uuid) to authenticated;
grant execute on function app_private.current_user_can_read_structure_node(uuid) to authenticated;
grant execute on function app_private.current_user_can_read_structure_edge(uuid) to authenticated;
grant execute on function app_private.current_user_can_read_entity(uuid) to authenticated;
grant execute on function app_private.current_user_can_read_entity_relationship(uuid) to authenticated;
grant execute on function app_private.current_user_can_read_canonical_event(uuid) to authenticated;
grant execute on function app_private.current_user_can_read_person(uuid) to authenticated;
grant execute on function app_private.current_user_can_read_position_assignment(uuid) to authenticated;
grant execute on function app_private.current_user_can_view_calendar_record(text, uuid, text) to authenticated;
grant execute on function app_private.current_user_can_view_document(uuid, text, text) to authenticated;

comment on policy structure_templates_select_anon_active on public.structure_templates is
  'Anonymous readers receive only active public structure templates without direct access to private authorization helpers.';
comment on policy ecclesiastical_entities_select_anon_public on public.ecclesiastical_entities is
  'Anonymous readers receive only active public entities; scoped administrative visibility is evaluated separately.';

commit;
