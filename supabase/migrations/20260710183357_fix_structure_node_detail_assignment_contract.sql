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
    'node', jsonb_build_object(
      'id', n.id, 'template_id', n.template_id, 'level_id', n.level_id, 'diocese_id', n.diocese_id,
      'parent_node_id', n.parent_node_id, 'name', n.name, 'official_name', n.official_name,
      'slug', n.slug, 'code', n.code, 'description', n.description,
      'linked_ecclesiastical_entity_id', n.linked_ecclesiastical_entity_id,
      'linked_pastoral_entity_id', n.linked_pastoral_entity_id,
      'start_date', n.start_date, 'end_date', n.end_date, 'is_current', n.is_current,
      'status', n.status, 'visibility', n.visibility, 'source_name', n.source_name,
      'source_url', n.source_url, 'source_checked_at', n.source_checked_at,
      'metadata', coalesce(n.metadata, '{}'::jsonb), 'created_at', n.created_at, 'updated_at', n.updated_at
    ),
    'level', jsonb_build_object(
      'id', l.id, 'key', l.level_key, 'name', l.name, 'plural_name', l.plural_name,
      'scope', l.scope, 'level_order', l.level_order, 'is_required', l.is_required,
      'allows_new_nodes', l.allows_new_nodes
    ),
    'template', jsonb_build_object(
      'id', t.id, 'name', t.name, 'kind_key', t.kind_key, 'status', t.status, 'is_primary', t.is_primary
    ),
    'parent', case when p.id is null then null else jsonb_build_object(
      'id', p.id, 'name', p.name, 'level_id', p.level_id, 'status', p.status
    ) end,
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
    'current_assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assignment_id', pa.id,
        'office_configuration_id', pa.office_configuration_id,
        'office_name', coalesce(pa.title_override, oc.display_name),
        'person_id', pa.person_id,
        'person_name', coalesce(pe.formal_display_name, pe.display_name, trim(concat_ws(' ', pe.first_name, pe.last_name))),
        'start_date', coalesce(pa.effective_date, pa.start_date, pa.term_start_date),
        'end_date', coalesce(pa.actual_end_date, pa.term_end_date),
        'assignment_status', pa.assignment_status,
        'record_status', pa.record_status,
        'publication_status', pa.publication_status,
        'is_current', pa.is_current
      ) order by oc.sort_order, pe.last_name, pe.first_name)
      from public.position_assignments pa
      join public.office_configurations oc on oc.id = pa.office_configuration_id
      left join public.persons pe on pe.id = pa.person_id
      where pa.is_current = true
        and pa.record_status <> 'archived'
        and (
          (n.linked_ecclesiastical_entity_id is not null and pa.ecclesiastical_entity_id = n.linked_ecclesiastical_entity_id)
          or (n.linked_pastoral_entity_id is not null and pa.pastoral_entity_id = n.linked_pastoral_entity_id)
        )
    ), '[]'::jsonb),
    'history', jsonb_build_object(
      'assignment_count', (
        select count(*) from public.position_assignments pa
        where (n.linked_ecclesiastical_entity_id is not null and pa.ecclesiastical_entity_id = n.linked_ecclesiastical_entity_id)
           or (n.linked_pastoral_entity_id is not null and pa.pastoral_entity_id = n.linked_pastoral_entity_id)
      ),
      'edge_count', (select count(*) from public.structure_node_edges e where e.child_node_id = n.id),
      'structural_event_count', 0
    )
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