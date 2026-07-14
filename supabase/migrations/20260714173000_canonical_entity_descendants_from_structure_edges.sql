-- Canonical institutional descendant projection.
-- Descendancy is derived exclusively from current territorial structure nodes and edges.

create or replace function public.get_entity_descendants(
  p_entity_id uuid,
  p_max_depth integer default 10
)
returns table (
  id uuid,
  name text,
  official_name text,
  slug text,
  entity_type_id uuid,
  depth integer
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with recursive roots as (
    select
      sn.id as node_id,
      sn.template_id,
      0 as depth,
      array[sn.id]::uuid[] as path_ids
    from public.structure_nodes sn
    join public.structure_templates st on st.id = sn.template_id
    where sn.linked_ecclesiastical_entity_id = p_entity_id
      and sn.is_current = true
      and sn.status = 'active'
      and st.status = 'active'
      and st.kind_key = 'territorial'
  ),
  descendants as (
    select node_id, template_id, depth, path_ids
    from roots

    union all

    select
      child.id,
      edge.template_id,
      parent.depth + 1,
      parent.path_ids || child.id
    from descendants parent
    join public.structure_node_edges edge
      on edge.parent_node_id = parent.node_id
     and edge.template_id = parent.template_id
     and edge.is_current = true
     and edge.status = 'active'
     and edge.start_date <= current_date
     and (edge.end_date is null or edge.end_date >= current_date)
    join public.structure_nodes child
      on child.id = edge.child_node_id
     and child.template_id = edge.template_id
     and child.is_current = true
     and child.status = 'active'
     and child.start_date <= current_date
     and (child.end_date is null or child.end_date >= current_date)
    where parent.depth < greatest(coalesce(p_max_depth, 10), 0)
      and not child.id = any(parent.path_ids)
  ),
  ranked as (
    select
      sn.linked_ecclesiastical_entity_id as entity_id,
      min(d.depth)::integer as depth
    from descendants d
    join public.structure_nodes sn on sn.id = d.node_id
    where d.depth > 0
      and sn.linked_ecclesiastical_entity_id is not null
      and sn.linked_ecclesiastical_entity_id <> p_entity_id
    group by sn.linked_ecclesiastical_entity_id
  )
  select
    ee.id,
    ee.name,
    ee.official_name,
    ee.slug,
    ee.entity_type_id,
    ranked.depth
  from ranked
  join public.ecclesiastical_entities ee on ee.id = ranked.entity_id
  where ee.status = 'active'
  order by ranked.depth, ee.name;
$function$;

revoke all on function public.get_entity_descendants(uuid, integer) from public;
revoke all on function public.get_entity_descendants(uuid, integer) from anon;
grant execute on function public.get_entity_descendants(uuid, integer) to authenticated;

comment on function public.get_entity_descendants(uuid, integer) is
  'Returns active institutional descendants projected from current territorial structure_node_edges; no parallel entity parent hierarchy is used.';
