create or replace function app_private.structure_template_in_scope(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, app_private, auth, pg_temp
as $$
  select exists (
    select 1
    from public.structure_templates st
    where st.id = p_template_id
      and app_private.current_user_can_manage_entity('structures.manage', st.diocese_id)
  );
$$;

revoke all on function app_private.structure_template_in_scope(uuid)
  from public, anon, authenticated;
grant execute on function app_private.structure_template_in_scope(uuid) to authenticated;

revoke insert, update, delete, truncate, references, trigger
  on public.diocese_structure_templates,
     public.diocese_structure_levels,
     public.pastoral_structure_templates,
     public.pastoral_structure_levels
  from anon, authenticated;

grant select
  on public.diocese_structure_templates,
     public.diocese_structure_levels,
     public.pastoral_structure_templates,
     public.pastoral_structure_levels
  to authenticated;

revoke insert, update, delete, truncate, references, trigger
  on public.structure_templates,
     public.structure_levels,
     public.structure_level_edges,
     public.structure_nodes,
     public.structure_node_edges
  from anon, authenticated;

grant select
  on public.structure_templates,
     public.structure_levels,
     public.structure_level_edges,
     public.structure_nodes,
     public.structure_node_edges
  to anon, authenticated;
