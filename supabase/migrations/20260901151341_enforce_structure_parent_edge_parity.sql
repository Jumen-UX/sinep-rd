-- Garantiza al commit que parent_node_id y structure_node_edges representen la misma relación vigente.

create or replace function app_private.enforce_structure_parent_edge_parity()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
declare
  v_child_id uuid;
  v_parent_id uuid;
  v_node_is_current boolean;
  v_node_status text;
  v_current_edge_count integer;
  v_matching_edge_count integer;
begin
  for v_child_id in
    select distinct child_id
    from unnest(array[
      case when tg_table_name = 'structure_nodes' then coalesce(new.id, old.id) else coalesce(new.child_node_id, old.child_node_id) end,
      case when tg_table_name = 'structure_node_edges' and tg_op = 'UPDATE' then old.child_node_id else null end
    ]::uuid[]) as candidate(child_id)
    where child_id is not null
  loop
    select parent_node_id, is_current, status
      into v_parent_id, v_node_is_current, v_node_status
    from public.structure_nodes
    where id = v_child_id;

    if not found then
      continue;
    end if;

    select
      count(*)::integer,
      count(*) filter (where parent_node_id is not distinct from v_parent_id)::integer
      into v_current_edge_count, v_matching_edge_count
    from public.structure_node_edges
    where child_node_id = v_child_id
      and is_current = true
      and status = 'active';

    if v_node_is_current = true and v_node_status = 'active' then
      if v_parent_id is null then
        if v_current_edge_count <> 0 then
          raise exception using
            errcode = '23514',
            message = format('Current root structure node %s cannot have a current active parent edge', v_child_id);
        end if;
      elsif v_current_edge_count <> 1 or v_matching_edge_count <> 1 then
        raise exception using
          errcode = '23514',
          message = format('Current structure node %s must have exactly one current active edge matching parent_node_id %s', v_child_id, v_parent_id);
      end if;
    elsif v_current_edge_count <> 0 then
      raise exception using
        errcode = '23514',
        message = format('Non-current or inactive structure node %s cannot have a current active parent edge', v_child_id);
    end if;
  end loop;

  return coalesce(new, old);
end;
$$;

revoke all on function app_private.enforce_structure_parent_edge_parity() from public;
revoke all on function app_private.enforce_structure_parent_edge_parity() from anon;
revoke all on function app_private.enforce_structure_parent_edge_parity() from authenticated;

drop trigger if exists trg_structure_nodes_parent_edge_parity on public.structure_nodes;
create constraint trigger trg_structure_nodes_parent_edge_parity
after insert or update or delete on public.structure_nodes
deferrable initially deferred
for each row execute function app_private.enforce_structure_parent_edge_parity();

drop trigger if exists trg_structure_node_edges_parent_edge_parity on public.structure_node_edges;
create constraint trigger trg_structure_node_edges_parent_edge_parity
after insert or update or delete on public.structure_node_edges
deferrable initially deferred
for each row execute function app_private.enforce_structure_parent_edge_parity();
