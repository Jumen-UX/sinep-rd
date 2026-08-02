-- Expose the public territorial hierarchy through a read-only view.
-- Anonymous clients may select public projections but must not execute functions.

revoke execute on function public.get_public_jurisdiction_structure_tree(uuid, date) from anon;
grant execute on function public.get_public_jurisdiction_structure_tree(uuid, date) to authenticated;

drop view if exists public.public_jurisdiction_structure_tree;

create view public.public_jurisdiction_structure_tree
with (security_invoker = true)
as
with recursive eligible_templates as (
  select
    t.id,
    t.diocese_id as jurisdiction_id
  from public.structure_templates t
  where t.kind_key = 'territorial'
    and t.is_active
    and t.is_primary
    and t.status = 'active'
    and t.visibility = 'public'
),
eligible_nodes as (
  select
    n.*,
    t.jurisdiction_id
  from public.structure_nodes n
  join eligible_templates t on t.id = n.template_id
  where n.is_current
    and n.status = 'active'
    and n.visibility = 'public'
    and n.start_date <= current_date
    and (n.end_date is null or n.end_date >= current_date)
),
eligible_edges as (
  select
    e.*,
    t.jurisdiction_id
  from public.structure_node_edges e
  join eligible_templates t on t.id = e.template_id
  where e.is_current
    and e.status = 'active'
    and e.start_date <= current_date
    and (e.end_date is null or e.end_date >= current_date)
),
tree as (
  select
    n.jurisdiction_id,
    n.id as node_id,
    n.template_id,
    n.level_id,
    l.level_key,
    l.name as level_name,
    null::uuid as parent_node_id,
    0 as depth,
    array[n.id]::uuid[] as path_ids,
    array[n.name]::text[] as path_names,
    n.name,
    n.official_name,
    n.slug,
    n.linked_ecclesiastical_entity_id
  from eligible_nodes n
  join public.structure_levels l on l.id = n.level_id
  where not exists (
    select 1
    from eligible_edges root_edge
    where root_edge.child_node_id = n.id
      and root_edge.jurisdiction_id = n.jurisdiction_id
  )

  union all

  select
    parent.jurisdiction_id,
    child.id,
    child.template_id,
    child.level_id,
    child_level.level_key,
    child_level.name,
    edge.parent_node_id,
    parent.depth + 1,
    parent.path_ids || child.id,
    parent.path_names || child.name,
    child.name,
    child.official_name,
    child.slug,
    child.linked_ecclesiastical_entity_id
  from tree parent
  join eligible_edges edge
    on edge.parent_node_id = parent.node_id
   and edge.jurisdiction_id = parent.jurisdiction_id
  join eligible_nodes child
    on child.id = edge.child_node_id
   and child.jurisdiction_id = parent.jurisdiction_id
  join public.structure_levels child_level on child_level.id = child.level_id
  where child.template_id = parent.template_id
    and not child.id = any(parent.path_ids)
)
select
  t.jurisdiction_id,
  t.node_id,
  t.template_id,
  t.level_id,
  t.level_key,
  t.level_name,
  t.parent_node_id,
  t.depth,
  t.path_ids,
  t.path_names,
  t.name,
  t.official_name,
  t.slug,
  t.linked_ecclesiastical_entity_id,
  exists (
    select 1
    from eligible_edges child_edge
    join eligible_nodes child
      on child.id = child_edge.child_node_id
     and child.jurisdiction_id = t.jurisdiction_id
    where child_edge.parent_node_id = t.node_id
      and child_edge.jurisdiction_id = t.jurisdiction_id
      and child.template_id = t.template_id
  ) as has_children
from tree t;

revoke all on public.public_jurisdiction_structure_tree from public;
grant select on public.public_jurisdiction_structure_tree to anon, authenticated;

comment on view public.public_jurisdiction_structure_tree is
  'Current public territorial hierarchy by jurisdiction, built only from active public structure nodes and edges.';
