-- Public, read-only territorial projection for jurisdiction profile pages.

create or replace function public.get_public_jurisdiction_structure_tree(
  p_jurisdiction_id uuid,
  p_as_of date default current_date
)
returns table (
  node_id uuid,
  template_id uuid,
  level_id uuid,
  level_key text,
  level_name text,
  parent_node_id uuid,
  depth integer,
  path_ids uuid[],
  path_names text[],
  name text,
  official_name text,
  slug text,
  linked_ecclesiastical_entity_id uuid,
  has_children boolean
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
  with recursive eligible_templates as (
    select t.id
    from public.structure_templates t
    where t.diocese_id = p_jurisdiction_id
      and t.kind_key = 'territorial'
      and t.is_active
      and t.is_primary
      and t.status = 'active'
      and t.visibility = 'public'
  ),
  eligible_nodes as (
    select n.*
    from public.structure_nodes n
    join eligible_templates t on t.id = n.template_id
    where n.is_current
      and n.status = 'active'
      and n.visibility = 'public'
      and n.start_date <= p_as_of
      and (n.end_date is null or n.end_date >= p_as_of)
  ),
  eligible_edges as (
    select e.*
    from public.structure_node_edges e
    join eligible_templates t on t.id = e.template_id
    where e.is_current
      and e.status = 'active'
      and e.start_date <= p_as_of
      and (e.end_date is null or e.end_date >= p_as_of)
  ),
  tree as (
    select
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
    )

    union all

    select
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
    join eligible_edges edge on edge.parent_node_id = parent.node_id
    join eligible_nodes child on child.id = edge.child_node_id
    join public.structure_levels child_level on child_level.id = child.level_id
    where child.template_id = parent.template_id
      and not child.id = any(parent.path_ids)
  )
  select
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
      join eligible_nodes child on child.id = child_edge.child_node_id
      where child_edge.parent_node_id = t.node_id
        and child.template_id = t.template_id
    ) as has_children
  from tree t
  order by t.path_names;
$function$;

revoke all on function public.get_public_jurisdiction_structure_tree(uuid, date) from public;
grant execute on function public.get_public_jurisdiction_structure_tree(uuid, date) to anon, authenticated;

comment on function public.get_public_jurisdiction_structure_tree(uuid, date) is
  'Returns the current public territorial hierarchy for a jurisdiction profile, using structure_node_edges as the only parentage source.';
