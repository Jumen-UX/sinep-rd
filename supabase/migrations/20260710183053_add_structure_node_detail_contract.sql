create or replace function public.get_structure_node_detail(p_node_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, app_private, internal, auth, pg_temp
as $$
declare
  v_node public.structure_nodes%rowtype;
  v_result jsonb;
begin
  select * into v_node from public.structure_nodes where id = p_node_id;
  if not found then
    raise exception 'Structure node not found: %', p_node_id using errcode = 'P0002';
  end if;

  if not app_private.current_user_can_manage_entity('structures.manage', v_node.diocese_id)
     and v_node.visibility <> 'public' then
    raise exception 'Not authorized to view this structure node' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'node', to_jsonb(n),
    'level', jsonb_build_object('id', l.id, 'key', l.level_key, 'name', l.name, 'scope', l.scope, 'level_order', l.level_order),
    'template', jsonb_build_object('id', t.id, 'name', t.name, 'kind_key', t.kind_key, 'status', t.status, 'is_primary', t.is_primary),
    'parent', case when p.id is null then null else jsonb_build_object('id', p.id, 'name', p.name, 'level_id', p.level_id, 'status', p.status) end,
    'allowed_offices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mapping_id', sloc.id,
        'office_configuration_id', oc.id,
        'key', oc.key,
        'display_name', oc.display_name,
        'description', oc.description,
        'requires_clergy', oc.requires_clergy,
        'allowed_person_types', oc.allowed_person_types,
        'is_default', sloc.is_default,
        'sort_order', sloc.sort_order,
        'status', sloc.status
      ) order by sloc.sort_order, oc.display_name)
      from public.structure_level_office_configurations sloc
      join public.office_configurations oc on oc.id = sloc.office_configuration_id
      where sloc.level_id = n.level_id and sloc.status = 'active' and oc.status = 'active'
    ), '[]'::jsonb),
    'current_assignments', '[]'::jsonb,
    'history', jsonb_build_object('assignment_count', 0, 'edge_count', (select count(*) from public.structure_node_edges e where e.child_node_id = n.id), 'structural_event_count', 0)
  ) into v_result
  from public.structure_nodes n
  join public.structure_levels l on l.id = n.level_id
  join public.structure_templates t on t.id = n.template_id
  left join public.structure_nodes p on p.id = n.parent_node_id
  where n.id = p_node_id;

  return v_result;
end;
$$;

revoke all on function public.get_structure_node_detail(uuid) from public, anon;
grant execute on function public.get_structure_node_detail(uuid) to authenticated;

comment on function public.get_structure_node_detail(uuid) is
  'Returns consolidated detail for a canonical structure node.';