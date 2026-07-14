-- Make structure_node_edges the only source of current territorial parentage.

create or replace function public.get_structure_tree(
  p_template_id uuid,
  p_root_node_id uuid default null,
  p_as_of date default current_date,
  p_include_inactive boolean default false
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
  code text,
  linked_ecclesiastical_entity_id uuid,
  linked_organization_unit_id uuid,
  start_date date,
  end_date date,
  is_current boolean,
  status text,
  visibility text,
  has_children boolean
)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with recursive eligible_nodes as (
    select n.*
    from public.structure_nodes n
    where n.template_id = p_template_id
      and (
        p_include_inactive
        or (
          n.is_current
          and n.status = 'active'
          and n.start_date <= p_as_of
          and (n.end_date is null or n.end_date >= p_as_of)
        )
      )
  ),
  eligible_edges as (
    select e.*
    from public.structure_node_edges e
    where e.template_id = p_template_id
      and (
        p_include_inactive
        or (
          e.is_current
          and e.status = 'active'
          and e.start_date <= p_as_of
          and (e.end_date is null or e.end_date >= p_as_of)
        )
      )
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
      n.code,
      n.linked_ecclesiastical_entity_id,
      n.linked_organization_unit_id,
      n.start_date,
      n.end_date,
      n.is_current,
      n.status,
      n.visibility
    from eligible_nodes n
    join public.structure_levels l on l.id = n.level_id
    where (
      p_root_node_id is not null and n.id = p_root_node_id
    ) or (
      p_root_node_id is null
      and not exists (
        select 1 from eligible_edges root_edge where root_edge.child_node_id = n.id
      )
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
      child.code,
      child.linked_ecclesiastical_entity_id,
      child.linked_organization_unit_id,
      child.start_date,
      child.end_date,
      child.is_current,
      child.status,
      child.visibility
    from tree parent
    join eligible_edges edge on edge.parent_node_id = parent.node_id
    join eligible_nodes child on child.id = edge.child_node_id
    join public.structure_levels child_level on child_level.id = child.level_id
    where not child.id = any(parent.path_ids)
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
    t.code,
    t.linked_ecclesiastical_entity_id,
    t.linked_organization_unit_id,
    t.start_date,
    t.end_date,
    t.is_current,
    t.status,
    t.visibility,
    exists (
      select 1
      from eligible_edges child_edge
      join eligible_nodes child on child.id = child_edge.child_node_id
      where child_edge.parent_node_id = t.node_id
    ) as has_children
  from tree t
  order by t.path_names;
$function$;

comment on function public.get_structure_tree(uuid, uuid, date, boolean) is
  'Builds the territorial hierarchy exclusively from structure_node_edges; structure_nodes.parent_node_id is not a hierarchy source.';
