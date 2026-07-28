begin;

alter function app_private.rpc_definer__admin_save_organization_unit(jsonb)
rename to rpc_definer__admin_save_organization_unit_unscoped;

revoke all on function app_private.rpc_definer__admin_save_organization_unit_unscoped(jsonb)
from public, anon, authenticated;

create function app_private.rpc_definer__admin_save_organization_unit(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_existing_id uuid := app_private.audit_json_uuid(payload, 'id');
  v_requested_entity_id uuid := app_private.audit_json_uuid(payload, 'ecclesiastical_entity_id');
  v_requested_chart_id uuid := app_private.audit_json_uuid(payload, 'organization_chart_id');
  v_existing_entity_id uuid;
  v_existing_chart_id uuid;
  v_effective_payload jsonb := payload;
begin
  if auth.uid() is null then
    raise exception 'No autenticado.' using errcode = '42501';
  end if;

  if v_existing_id is not null then
    select unit_row.ecclesiastical_entity_id, unit_row.organization_chart_id
    into v_existing_entity_id, v_existing_chart_id
    from public.organization_units unit_row
    where unit_row.id = v_existing_id
    for update;

    if not found then
      raise exception 'La unidad organizativa indicada no existe.' using errcode = 'P0002';
    end if;

    if v_requested_entity_id is not null
       and v_requested_entity_id <> v_existing_entity_id then
      raise exception 'La edición ordinaria no puede trasladar una unidad a otra entidad eclesiástica; utiliza un evento estructural.' using errcode = '22023';
    end if;

    if v_requested_chart_id is not null
       and v_requested_chart_id <> v_existing_chart_id then
      raise exception 'La edición ordinaria no puede trasladar una unidad a otro organigrama; utiliza un evento estructural.' using errcode = '22023';
    end if;

    if not app_private.current_user_can_manage_entity('pastorals.update_proposal', v_existing_entity_id) then
      raise exception 'No autorizado para modificar esta unidad organizativa.' using errcode = '42501';
    end if;

    v_effective_payload := jsonb_set(
      jsonb_set(v_effective_payload, '{ecclesiastical_entity_id}', to_jsonb(v_existing_entity_id::text), true),
      '{organization_chart_id}',
      to_jsonb(v_existing_chart_id::text),
      true
    );
  else
    if v_requested_entity_id is null then
      raise exception 'La entidad eclesiástica de la unidad es obligatoria.' using errcode = '22023';
    end if;

    if not app_private.current_user_can_manage_entity('pastorals.create_proposal', v_requested_entity_id) then
      raise exception 'No autorizado para crear unidades organizativas en este ámbito.' using errcode = '42501';
    end if;
  end if;

  return app_private.rpc_definer__admin_save_organization_unit_unscoped(v_effective_payload);
end;
$$;

revoke all on function app_private.rpc_definer__admin_save_organization_unit(jsonb)
from public, anon, authenticated;

alter function app_private.rpc_definer__admin_save_structure_template(jsonb)
rename to rpc_definer__admin_save_structure_template_unscoped;

revoke all on function app_private.rpc_definer__admin_save_structure_template_unscoped(jsonb)
from public, anon, authenticated;

create function app_private.rpc_definer__admin_save_structure_template(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_existing_id uuid := app_private.audit_json_uuid(payload, 'id');
  v_requested_diocese_id uuid := app_private.audit_json_uuid(payload, 'diocese_id');
  v_existing_diocese_id uuid;
  v_effective_diocese_id uuid;
  v_effective_payload jsonb := payload;
begin
  if v_existing_id is not null then
    select template_row.diocese_id
    into v_existing_diocese_id
    from public.structure_templates template_row
    where template_row.id = v_existing_id
    for update;

    if not found then
      raise exception 'La plantilla estructural indicada no existe.' using errcode = 'P0002';
    end if;

    if v_requested_diocese_id is not null
       and v_requested_diocese_id <> v_existing_diocese_id then
      raise exception 'Una plantilla estructural no puede trasladarse a otra diócesis mediante edición ordinaria.' using errcode = '22023';
    end if;

    v_effective_diocese_id := v_existing_diocese_id;
  else
    v_effective_diocese_id := v_requested_diocese_id;
  end if;

  if v_effective_diocese_id is null
     or not app_private.current_user_can_manage_entity('structures.manage', v_effective_diocese_id) then
    raise exception 'No autorizado para configurar estructuras en esta diócesis.' using errcode = '42501';
  end if;

  v_effective_payload := jsonb_set(
    v_effective_payload,
    '{diocese_id}',
    to_jsonb(v_effective_diocese_id::text),
    true
  );

  return app_private.rpc_definer__admin_save_structure_template_unscoped(v_effective_payload);
end;
$$;

revoke all on function app_private.rpc_definer__admin_save_structure_template(jsonb)
from public, anon, authenticated;

alter function app_private.rpc_definer__admin_save_structure_level(jsonb)
rename to rpc_definer__admin_save_structure_level_unscoped;

revoke all on function app_private.rpc_definer__admin_save_structure_level_unscoped(jsonb)
from public, anon, authenticated;

create function app_private.rpc_definer__admin_save_structure_level(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_existing_id uuid := app_private.audit_json_uuid(payload, 'id');
  v_requested_template_id uuid := app_private.audit_json_uuid(payload, 'template_id');
  v_existing_template_id uuid;
  v_effective_template_id uuid;
  v_parent_level_id uuid := app_private.audit_json_uuid(payload, 'parent_level_id');
  v_effective_payload jsonb := payload;
begin
  if v_existing_id is not null then
    select level_row.template_id
    into v_existing_template_id
    from public.structure_levels level_row
    where level_row.id = v_existing_id
    for update;

    if not found then
      raise exception 'El nivel estructural indicado no existe.' using errcode = 'P0002';
    end if;

    if v_requested_template_id is not null
       and v_requested_template_id <> v_existing_template_id then
      raise exception 'Un nivel estructural no puede trasladarse a otra plantilla mediante edición ordinaria.' using errcode = '22023';
    end if;

    v_effective_template_id := v_existing_template_id;
  else
    v_effective_template_id := v_requested_template_id;
  end if;

  if v_effective_template_id is null
     or not app_private.structure_template_in_scope(v_effective_template_id) then
    raise exception 'No autorizado para configurar niveles en esta plantilla.' using errcode = '42501';
  end if;

  if v_parent_level_id is not null
     and not exists (
       select 1
       from public.structure_levels parent_level
       where parent_level.id = v_parent_level_id
         and parent_level.template_id = v_effective_template_id
     ) then
    raise exception 'El nivel superior debe pertenecer a la misma plantilla.' using errcode = '22023';
  end if;

  v_effective_payload := jsonb_set(
    v_effective_payload,
    '{template_id}',
    to_jsonb(v_effective_template_id::text),
    true
  );

  return app_private.rpc_definer__admin_save_structure_level_unscoped(v_effective_payload);
end;
$$;

revoke all on function app_private.rpc_definer__admin_save_structure_level(jsonb)
from public, anon, authenticated;

alter function app_private.rpc_definer__admin_save_structure_node(jsonb)
rename to rpc_definer__admin_save_structure_node_unscoped;

revoke all on function app_private.rpc_definer__admin_save_structure_node_unscoped(jsonb)
from public, anon, authenticated;

create function app_private.rpc_definer__admin_save_structure_node(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_existing_id uuid := app_private.audit_json_uuid(payload, 'id');
  v_requested_template_id uuid := app_private.audit_json_uuid(payload, 'template_id');
  v_existing_template_id uuid;
  v_effective_template_id uuid;
  v_level_id uuid := app_private.audit_json_uuid(payload, 'level_id');
  v_parent_node_id uuid := app_private.audit_json_uuid(payload, 'parent_node_id');
  v_linked_entity_id uuid := app_private.audit_json_uuid(payload, 'linked_ecclesiastical_entity_id');
  v_linked_unit_id uuid := app_private.audit_json_uuid(payload, 'linked_organization_unit_id');
  v_linked_unit_entity_id uuid;
  v_diocese_id uuid;
  v_diocese_country_iso2 char(2);
  v_linked_country_iso2 char(2);
  v_linked_diocese_id uuid;
  v_effective_payload jsonb := payload;
begin
  if v_existing_id is not null then
    select node_row.template_id
    into v_existing_template_id
    from public.structure_nodes node_row
    where node_row.id = v_existing_id
    for update;

    if not found then
      raise exception 'El nodo estructural indicado no existe.' using errcode = 'P0002';
    end if;

    if v_requested_template_id is not null
       and v_requested_template_id <> v_existing_template_id then
      raise exception 'Un nodo estructural no puede trasladarse a otra plantilla mediante edición ordinaria.' using errcode = '22023';
    end if;

    v_effective_template_id := v_existing_template_id;
  else
    v_effective_template_id := v_requested_template_id;
  end if;

  select template_row.diocese_id
  into v_diocese_id
  from public.structure_templates template_row
  where template_row.id = v_effective_template_id;

  if v_diocese_id is null
     or not app_private.current_user_can_manage_entity('structures.manage', v_diocese_id) then
    raise exception 'No autorizado para modificar nodos en esta plantilla.' using errcode = '42501';
  end if;

  if v_level_id is null
     or not exists (
       select 1
       from public.structure_levels level_row
       where level_row.id = v_level_id
         and level_row.template_id = v_effective_template_id
     ) then
    raise exception 'El nivel del nodo debe pertenecer a la misma plantilla.' using errcode = '22023';
  end if;

  if v_parent_node_id is not null
     and not exists (
       select 1
       from public.structure_nodes parent_node
       where parent_node.id = v_parent_node_id
         and parent_node.template_id = v_effective_template_id
         and parent_node.diocese_id = v_diocese_id
     ) then
    raise exception 'El nodo superior debe pertenecer a la misma plantilla y diócesis.' using errcode = '22023';
  end if;

  v_diocese_country_iso2 := app_private.resolve_entity_country_iso2(v_diocese_id);
  if v_diocese_country_iso2 is null then
    raise exception 'No se pudo resolver el país de la diócesis estructural.' using errcode = '22023';
  end if;

  if v_linked_entity_id is not null then
    v_linked_country_iso2 := app_private.resolve_entity_country_iso2(v_linked_entity_id);
    v_linked_diocese_id := app_private.resolve_entity_diocese_id(v_linked_entity_id);

    if v_linked_country_iso2 is distinct from v_diocese_country_iso2 then
      raise exception 'La entidad vinculada pertenece a otro país.' using errcode = '22023';
    end if;

    if v_linked_entity_id <> v_diocese_id
       and v_linked_diocese_id is not null
       and v_linked_diocese_id <> v_diocese_id then
      raise exception 'La entidad vinculada pertenece a otra diócesis.' using errcode = '22023';
    end if;

    if not app_private.current_user_can_manage_entity('entities.view', v_linked_entity_id) then
      raise exception 'La entidad vinculada está fuera de tu alcance.' using errcode = '42501';
    end if;
  end if;

  if v_linked_unit_id is not null then
    select unit_row.ecclesiastical_entity_id
    into v_linked_unit_entity_id
    from public.organization_units unit_row
    where unit_row.id = v_linked_unit_id;

    if v_linked_unit_entity_id is null then
      raise exception 'La unidad organizativa vinculada no existe.' using errcode = '22023';
    end if;

    v_linked_country_iso2 := app_private.resolve_entity_country_iso2(v_linked_unit_entity_id);
    v_linked_diocese_id := app_private.resolve_entity_diocese_id(v_linked_unit_entity_id);

    if v_linked_country_iso2 is distinct from v_diocese_country_iso2 then
      raise exception 'La unidad organizativa vinculada pertenece a otro país.' using errcode = '22023';
    end if;

    if v_linked_unit_entity_id <> v_diocese_id
       and v_linked_diocese_id is not null
       and v_linked_diocese_id <> v_diocese_id then
      raise exception 'La unidad organizativa vinculada pertenece a otra diócesis.' using errcode = '22023';
    end if;

    if not app_private.current_user_can_manage_entity('pastorals.view', v_linked_unit_entity_id) then
      raise exception 'La unidad organizativa vinculada está fuera de tu alcance.' using errcode = '42501';
    end if;
  end if;

  v_effective_payload := jsonb_set(
    v_effective_payload,
    '{template_id}',
    to_jsonb(v_effective_template_id::text),
    true
  );

  return app_private.rpc_definer__admin_save_structure_node_unscoped(v_effective_payload);
end;
$$;

revoke all on function app_private.rpc_definer__admin_save_structure_node(jsonb)
from public, anon, authenticated;

alter function app_private.rpc_definer__admin_apply_organization_unit_event(jsonb)
rename to rpc_definer__admin_apply_organization_unit_event_unscoped;

revoke all on function app_private.rpc_definer__admin_apply_organization_unit_event_unscoped(jsonb)
from public, anon, authenticated;

create function app_private.rpc_definer__admin_apply_organization_unit_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, internal, app_private, auth, pg_temp
as $$
declare
  v_event_id uuid := app_private.audit_json_uuid(payload, 'event_id');
  v_scope_entity_id uuid;
  v_is_super boolean := app_private.current_user_has_role(array['super_admin']);
begin
  if auth.uid() is null then
    raise exception 'No autenticado para aplicar eventos.' using errcode = '42501';
  end if;

  if not app_private.current_user_has_permission('events.apply') and not v_is_super then
    raise exception 'No autorizado para aplicar eventos.' using errcode = '42501';
  end if;

  v_scope_entity_id := app_private.canonical_event_scope_entity_id(v_event_id);

  if v_scope_entity_id is null and not v_is_super then
    raise exception 'El evento no tiene un alcance territorial administrable.' using errcode = '42501';
  end if;

  if v_scope_entity_id is not null
     and not app_private.current_user_can_manage_entity('events.apply', v_scope_entity_id) then
    raise exception 'El evento está fuera de tu alcance territorial.' using errcode = '42501';
  end if;

  return app_private.rpc_definer__admin_apply_organization_unit_event_unscoped(payload);
end;
$$;

revoke all on function app_private.rpc_definer__admin_apply_organization_unit_event(jsonb)
from public, anon, authenticated;

comment on function app_private.rpc_definer__admin_save_structure_node(jsonb) is
  'Guards template, diocese, parent, linked entity and linked organization-unit context before the canonical writer executes.';

comment on function app_private.rpc_definer__admin_save_organization_unit(jsonb) is
  'Ordinary edits cannot move an organization unit between ecclesiastical entities or organization charts; structural moves require canonical events.';

commit;
