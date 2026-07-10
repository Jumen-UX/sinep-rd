-- Priority 0: create the ecclesiastical entity and its structure node inside
-- one database transaction so a node validation failure cannot leave an orphan.

begin;

create or replace function public.admin_create_structure_node_entity(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, internal, app_private, pg_temp
as $$
declare
  v_template_id uuid := nullif(payload->>'template_id', '')::uuid;
  v_level_id uuid := nullif(payload->>'level_id', '')::uuid;
  v_parent_node_id uuid := nullif(payload->>'parent_node_id', '')::uuid;
  v_parent_entity_id uuid := nullif(payload->>'parent_entity_id', '')::uuid;
  v_diocese_id uuid;
  v_parent_linked_entity_id uuid;
  v_entity_result jsonb;
  v_node_result jsonb;
  v_entity_id uuid;
  v_node_id uuid;
begin
  if v_template_id is null or v_level_id is null or v_parent_node_id is null then
    raise exception 'Faltan plantilla, nivel o nodo superior' using errcode = '22023';
  end if;

  select st.diocese_id, parent_node.linked_ecclesiastical_entity_id
    into v_diocese_id, v_parent_linked_entity_id
  from public.structure_templates st
  join public.structure_nodes parent_node
    on parent_node.id = v_parent_node_id
   and parent_node.template_id = st.id
   and parent_node.is_current = true
   and parent_node.status = 'active'
  where st.id = v_template_id
    and st.is_active = true
    and st.status = 'active';

  if v_diocese_id is null then
    raise exception 'La plantilla o el nodo superior no están activos' using errcode = '22023';
  end if;

  if not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para modificar estructuras en esta diócesis' using errcode = '42501';
  end if;

  v_parent_entity_id := coalesce(v_parent_entity_id, v_parent_linked_entity_id);

  if v_parent_entity_id is null then
    raise exception 'El nodo superior no tiene una entidad eclesiástica vinculada' using errcode = '22023';
  end if;

  if v_parent_linked_entity_id is not null
     and v_parent_entity_id is distinct from v_parent_linked_entity_id then
    raise exception 'La entidad superior no corresponde al nodo estructural seleccionado' using errcode = '22023';
  end if;

  if not app_private.current_user_can_manage_entity('entities.create_proposal', v_parent_entity_id) then
    raise exception 'La entidad superior está fuera de tu alcance' using errcode = '42501';
  end if;

  v_entity_result := internal.admin_save_ecclesiastical_entity(
    jsonb_build_object(
      'entity_type_key', coalesce(nullif(payload->>'entity_type_key', ''), 'parish'),
      'name', nullif(btrim(payload->>'name'), ''),
      'official_name', nullif(btrim(payload->>'official_name'), ''),
      'slug', nullif(btrim(payload->>'slug'), ''),
      'description', nullif(btrim(payload->>'description'), ''),
      'country_iso2', coalesce(nullif(upper(btrim(payload->>'country_iso2')), ''), 'DO'),
      'country', nullif(btrim(payload->>'country'), ''),
      'parent_entity_id', v_parent_entity_id,
      'erected_at', nullif(payload->>'start_date', ''),
      'source_name', nullif(btrim(payload->>'source_name'), ''),
      'source_url', nullif(btrim(payload->>'source_url'), ''),
      'source_checked_at', nullif(payload->>'source_checked_at', ''),
      'not_identified_fields', coalesce(payload->'not_identified_fields', '[]'::jsonb)
    )
  );

  v_entity_id := nullif(v_entity_result->>'entity_id', '')::uuid;
  if v_entity_id is null then
    raise exception 'La entidad fue creada sin identificador' using errcode = 'P0001';
  end if;

  v_node_result := internal.admin_save_structure_node(
    jsonb_build_object(
      'template_id', v_template_id,
      'level_id', v_level_id,
      'parent_node_id', v_parent_node_id,
      'name', nullif(btrim(payload->>'name'), ''),
      'official_name', coalesce(nullif(btrim(payload->>'official_name'), ''), nullif(btrim(payload->>'name'), '')),
      'slug', nullif(btrim(payload->>'slug'), ''),
      'description', nullif(btrim(payload->>'description'), ''),
      'linked_ecclesiastical_entity_id', v_entity_id,
      'start_date', coalesce(nullif(payload->>'start_date', ''), current_date::text),
      'status', 'active',
      'visibility', coalesce(nullif(payload->>'visibility', ''), 'public'),
      'source_name', nullif(btrim(payload->>'source_name'), ''),
      'source_url', nullif(btrim(payload->>'source_url'), ''),
      'source_checked_at', nullif(payload->>'source_checked_at', '')
    )
  );

  v_node_id := coalesce(
    nullif(v_node_result->>'id', '')::uuid,
    nullif(v_node_result->>'node_id', '')::uuid
  );

  if v_node_id is null then
    raise exception 'El nodo fue creado sin identificador' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'entity_id', v_entity_id,
    'node_id', v_node_id,
    'template_id', v_template_id,
    'level_id', v_level_id,
    'parent_node_id', v_parent_node_id
  );
end;
$$;

revoke all on function public.admin_create_structure_node_entity(jsonb) from public, anon;
grant execute on function public.admin_create_structure_node_entity(jsonb) to authenticated;

commit;
