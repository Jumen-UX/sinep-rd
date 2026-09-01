-- Corrige el trigger de paridad para evitar referencias a columnas de la otra tabla.

create or replace function app_private.enforce_structure_parent_edge_parity()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $$
declare
  v_child_ids uuid[];
  v_child_id uuid;
  v_parent_id uuid;
  v_node_is_current boolean;
  v_node_status text;
  v_current_edge_count integer;
  v_matching_edge_count integer;
begin
  if tg_table_name = 'structure_nodes' then
    if tg_op = 'DELETE' then
      v_child_ids := array[old.id];
    else
      v_child_ids := array[new.id];
    end if;
  elsif tg_table_name = 'structure_node_edges' then
    if tg_op = 'INSERT' then
      v_child_ids := array[new.child_node_id];
    elsif tg_op = 'DELETE' then
      v_child_ids := array[old.child_node_id];
    else
      v_child_ids := array[new.child_node_id, old.child_node_id];
    end if;
  else
    raise exception using
      errcode = 'P0001',
      message = format('Unsupported parity trigger table: %s', tg_table_name);
  end if;

  foreach v_child_id in array v_child_ids
  loop
    if v_child_id is null then
      continue;
    end if;

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
