-- Safe structural dependency changes for the current jurisdiction organigram.
-- Preview is read-only; confirmation revalidates and applies atomically with audit.

create or replace function public.admin_preview_jurisdiction_dependency_change(
  p_child_account_id uuid,
  p_new_parent_account_id uuid,
  p_relationship_type text,
  p_effective_date date default current_date,
  p_reason text default null,
  p_source_document_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_child public.jurisdiction_accounts%rowtype;
  v_parent public.jurisdiction_accounts%rowtype;
  v_child_entity public.ecclesiastical_entities%rowtype;
  v_parent_entity public.ecclesiastical_entities%rowtype;
  v_current_edge public.jurisdiction_account_edges%rowtype;
  v_current_parent_name text;
  v_rule public.jurisdiction_account_type_rules%rowtype;
  v_errors jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_cycle boolean := false;
begin
  if v_actor is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para modificar el organigrama jurisdiccional' using errcode = '42501';
  end if;

  if p_child_account_id is null or p_new_parent_account_id is null then
    raise exception 'La jurisdicción y su nueva dependencia son obligatorias' using errcode = '22023';
  end if;

  if nullif(btrim(p_relationship_type), '') is null then
    raise exception 'El tipo de relación es obligatorio' using errcode = '22023';
  end if;

  select * into v_child
  from public.jurisdiction_accounts
  where id = p_child_account_id;

  if not found then
    raise exception 'Cuenta jurisdiccional hija no encontrada' using errcode = 'P0002';
  end if;

  select * into v_parent
  from public.jurisdiction_accounts
  where id = p_new_parent_account_id;

  if not found then
    raise exception 'Cuenta jurisdiccional superior no encontrada' using errcode = 'P0002';
  end if;

  select * into v_child_entity
  from public.ecclesiastical_entities
  where id = v_child.ecclesiastical_entity_id;

  select * into v_parent_entity
  from public.ecclesiastical_entities
  where id = v_parent.ecclesiastical_entity_id;

  select edge.*, parent_entity.name
  into v_current_edge, v_current_parent_name
  from public.jurisdiction_account_edges edge
  join public.jurisdiction_accounts parent_account on parent_account.id = edge.parent_account_id
  join public.ecclesiastical_entities parent_entity on parent_entity.id = parent_account.ecclesiastical_entity_id
  where edge.child_account_id = p_child_account_id
    and edge.is_current
    and edge.status = 'active'
  order by edge.created_at desc
  limit 1;

  select * into v_rule
  from public.jurisdiction_account_type_rules
  where parent_entity_type_id = v_parent_entity.entity_type_id
    and child_entity_type_id = v_child_entity.entity_type_id
    and relationship_type = btrim(p_relationship_type)
    and status = 'active'
    and is_allowed
  limit 1;

  if p_child_account_id = p_new_parent_account_id then
    v_errors := v_errors || jsonb_build_array('Una jurisdicción no puede depender de sí misma.');
  end if;

  if not v_child.is_current or v_child.status <> 'active' then
    v_errors := v_errors || jsonb_build_array('La jurisdicción que se moverá no está activa en el organigrama vigente.');
  end if;

  if not v_parent.is_current or v_parent.status <> 'active' then
    v_errors := v_errors || jsonb_build_array('La nueva dependencia no está activa en el organigrama vigente.');
  end if;

  if v_rule.id is null then
    v_errors := v_errors || jsonb_build_array('La relación padre/hijo seleccionada no está permitida por las reglas jurisdiccionales.');
  elsif v_rule.requires_source and p_source_document_id is null then
    v_errors := v_errors || jsonb_build_array('Este cambio estructural requiere una fuente documental.');
  end if;

  if p_effective_date is null then
    v_errors := v_errors || jsonb_build_array('La fecha efectiva es obligatoria.');
  elsif v_current_edge.id is not null and p_effective_date <= v_current_edge.valid_from then
    v_errors := v_errors || jsonb_build_array('La fecha efectiva debe ser posterior al inicio de la dependencia vigente.');
  end if;

  if nullif(btrim(p_reason), '') is null then
    v_errors := v_errors || jsonb_build_array('Indica brevemente el motivo del cambio.');
  end if;

  with recursive descendants as (
    select edge.child_account_id
    from public.jurisdiction_account_edges edge
    where edge.parent_account_id = p_child_account_id
      and edge.is_current
      and edge.status = 'active'
    union
    select edge.child_account_id
    from descendants d
    join public.jurisdiction_account_edges edge on edge.parent_account_id = d.child_account_id
    where edge.is_current
      and edge.status = 'active'
  )
  select exists(select 1 from descendants where child_account_id = p_new_parent_account_id)
  into v_cycle;

  if v_cycle then
    v_errors := v_errors || jsonb_build_array('El cambio produciría un ciclo en el organigrama.');
  end if;

  if v_current_edge.id is null then
    v_warnings := v_warnings || jsonb_build_array('La jurisdicción no tiene una dependencia vigente; se creará la primera.');
  elsif v_current_edge.parent_account_id = p_new_parent_account_id
    and v_current_edge.relationship_type = btrim(p_relationship_type) then
    v_warnings := v_warnings || jsonb_build_array('La dependencia propuesta coincide con la vigente; no habrá cambios.');
  end if;

  return jsonb_build_object(
    'valid', jsonb_array_length(v_errors) = 0,
    'errors', v_errors,
    'warnings', v_warnings,
    'child', jsonb_build_object(
      'account_id', v_child.id,
      'account_code', v_child.account_code,
      'name', v_child_entity.name
    ),
    'current_dependency', case when v_current_edge.id is null then null else jsonb_build_object(
      'edge_id', v_current_edge.id,
      'parent_account_id', v_current_edge.parent_account_id,
      'parent_name', v_current_parent_name,
      'relationship_type', v_current_edge.relationship_type,
      'valid_from', v_current_edge.valid_from
    ) end,
    'proposed_dependency', jsonb_build_object(
      'parent_account_id', v_parent.id,
      'parent_account_code', v_parent.account_code,
      'parent_name', v_parent_entity.name,
      'relationship_type', btrim(p_relationship_type),
      'effective_date', p_effective_date,
      'source_document_id', p_source_document_id
    ),
    'requires_source', coalesce(v_rule.requires_source, false)
  );
end;
$$;

create or replace function public.admin_apply_jurisdiction_dependency_change(
  p_child_account_id uuid,
  p_new_parent_account_id uuid,
  p_relationship_type text,
  p_effective_date date,
  p_reason text,
  p_source_document_id uuid default null,
  p_expected_current_edge_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_preview jsonb;
  v_child public.jurisdiction_accounts%rowtype;
  v_parent public.jurisdiction_accounts%rowtype;
  v_child_entity public.ecclesiastical_entities%rowtype;
  v_parent_entity public.ecclesiastical_entities%rowtype;
  v_current_edge public.jurisdiction_account_edges%rowtype;
  v_rule public.jurisdiction_account_type_rules%rowtype;
  v_new_edge_id uuid;
  v_operation_id uuid;
  v_audit_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_visibility text;
begin
  if v_actor is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para modificar el organigrama jurisdiccional' using errcode = '42501';
  end if;

  -- Lock the affected accounts before recomputing validation.
  select * into v_child
  from public.jurisdiction_accounts
  where id = p_child_account_id
  for update;

  if not found then
    raise exception 'Cuenta jurisdiccional hija no encontrada' using errcode = 'P0002';
  end if;

  select * into v_parent
  from public.jurisdiction_accounts
  where id = p_new_parent_account_id
  for update;

  if not found then
    raise exception 'Cuenta jurisdiccional superior no encontrada' using errcode = 'P0002';
  end if;

  select * into v_current_edge
  from public.jurisdiction_account_edges
  where child_account_id = p_child_account_id
    and is_current
    and status = 'active'
  order by created_at desc
  limit 1
  for update;

  if p_expected_current_edge_id is not null
    and v_current_edge.id is distinct from p_expected_current_edge_id then
    raise exception 'La dependencia vigente cambió desde la vista previa. Recarga antes de confirmar.' using errcode = '40001';
  end if;

  v_preview := public.admin_preview_jurisdiction_dependency_change(
    p_child_account_id,
    p_new_parent_account_id,
    p_relationship_type,
    p_effective_date,
    p_reason,
    p_source_document_id
  );

  if not coalesce((v_preview->>'valid')::boolean, false) then
    raise exception 'Cambio jurisdiccional inválido: %', v_preview->'errors' using errcode = '22023';
  end if;

  if v_current_edge.id is not null
    and v_current_edge.parent_account_id = p_new_parent_account_id
    and v_current_edge.relationship_type = btrim(p_relationship_type) then
    return jsonb_build_object(
      'status', 'noop',
      'child_account_id', p_child_account_id,
      'current_edge_id', v_current_edge.id,
      'preview', v_preview
    );
  end if;

  select * into v_child_entity
  from public.ecclesiastical_entities
  where id = v_child.ecclesiastical_entity_id;

  select * into v_parent_entity
  from public.ecclesiastical_entities
  where id = v_parent.ecclesiastical_entity_id;

  select * into v_rule
  from public.jurisdiction_account_type_rules
  where parent_entity_type_id = v_parent_entity.entity_type_id
    and child_entity_type_id = v_child_entity.entity_type_id
    and relationship_type = btrim(p_relationship_type)
    and status = 'active'
    and is_allowed
  limit 1;

  if v_rule.id is null then
    raise exception 'La relación padre/hijo seleccionada dejó de ser válida.' using errcode = '40001';
  end if;

  v_before := case when v_current_edge.id is null then null else jsonb_build_object(
    'edge_id', v_current_edge.id,
    'parent_account_id', v_current_edge.parent_account_id,
    'child_account_id', v_current_edge.child_account_id,
    'relationship_type', v_current_edge.relationship_type,
    'valid_from', v_current_edge.valid_from,
    'valid_to', v_current_edge.valid_to,
    'is_current', v_current_edge.is_current,
    'status', v_current_edge.status,
    'source_document_id', v_current_edge.source_document_id
  ) end;

  if v_current_edge.id is not null then
    update public.jurisdiction_account_edges
    set
      valid_to = p_effective_date - 1,
      is_current = false,
      status = 'inactive',
      updated_at = now()
    where id = v_current_edge.id;
  end if;

  v_visibility := case
    when v_child.visibility = 'public' and v_parent.visibility = 'public' then 'public'
    else 'internal'
  end;

  insert into public.jurisdiction_account_edges(
    parent_account_id,
    child_account_id,
    relationship_type,
    valid_from,
    valid_to,
    is_current,
    status,
    visibility,
    source_document_id,
    notes,
    created_by
  ) values (
    p_new_parent_account_id,
    p_child_account_id,
    btrim(p_relationship_type),
    p_effective_date,
    null,
    true,
    'active',
    v_visibility,
    p_source_document_id,
    nullif(btrim(p_reason), ''),
    v_actor
  )
  returning id into v_new_edge_id;

  v_after := jsonb_build_object(
    'edge_id', v_new_edge_id,
    'parent_account_id', p_new_parent_account_id,
    'child_account_id', p_child_account_id,
    'relationship_type', btrim(p_relationship_type),
    'valid_from', p_effective_date,
    'valid_to', null,
    'is_current', true,
    'status', 'active',
    'source_document_id', p_source_document_id
  );

  insert into public.jurisdiction_change_operations(
    origin,
    status,
    publication_status,
    primary_account_id,
    effective_date,
    reason,
    source_document_id,
    operation_source,
    created_by,
    applied_by,
    created_at,
    applied_at,
    updated_at
  ) values (
    'organizational_change',
    'applied',
    'internal',
    p_child_account_id,
    p_effective_date,
    btrim(p_reason),
    p_source_document_id,
    'admin_organigram',
    v_actor,
    v_actor,
    now(),
    now(),
    now()
  ) returning id into v_operation_id;

  insert into public.jurisdiction_change_operation_accounts(operation_id, account_id, role)
  values(v_operation_id, p_new_parent_account_id, 'destination')
  on conflict do nothing;

  if v_current_edge.id is not null then
    insert into public.jurisdiction_change_operation_accounts(operation_id, account_id, role)
    values(v_operation_id, v_current_edge.parent_account_id, 'origin')
    on conflict do nothing;

    insert into public.jurisdiction_change_effects(
      operation_id, sequence, target_type, target_id, action, before_state, after_state, applied_at
    ) values (
      v_operation_id,
      1,
      'edge',
      v_current_edge.id,
      'close_dependency',
      v_before,
      v_before || jsonb_build_object('valid_to', p_effective_date - 1, 'is_current', false, 'status', 'inactive'),
      now()
    );
  end if;

  insert into public.jurisdiction_change_effects(
    operation_id, sequence, target_type, target_id, action, before_state, after_state, applied_at
  ) values (
    v_operation_id,
    case when v_current_edge.id is null then 1 else 2 end,
    'edge',
    v_new_edge_id,
    'create_dependency',
    null,
    v_after,
    now()
  );

  v_audit_id := public.admin_write_audit_log(
    'jurisdiction.dependency_change',
    'jurisdiction_accounts',
    p_child_account_id,
    jsonb_build_object(
      'kind', 'organizational_change',
      'operation_id', v_operation_id,
      'reason', btrim(p_reason),
      'effective_date', p_effective_date,
      'source_document_id', p_source_document_id,
      'before', v_before,
      'after', v_after
    )
  );

  return jsonb_build_object(
    'status', 'applied',
    'operation_id', v_operation_id,
    'audit_id', v_audit_id,
    'child_account_id', p_child_account_id,
    'previous_edge_id', v_current_edge.id,
    'current_edge_id', v_new_edge_id,
    'preview', v_preview
  );
end;
$$;

revoke execute on function public.admin_preview_jurisdiction_dependency_change(uuid, uuid, text, date, text, uuid) from public;
revoke execute on function public.admin_preview_jurisdiction_dependency_change(uuid, uuid, text, date, text, uuid) from anon;
grant execute on function public.admin_preview_jurisdiction_dependency_change(uuid, uuid, text, date, text, uuid) to authenticated;

revoke execute on function public.admin_apply_jurisdiction_dependency_change(uuid, uuid, text, date, text, uuid, uuid) from public;
revoke execute on function public.admin_apply_jurisdiction_dependency_change(uuid, uuid, text, date, text, uuid, uuid) from anon;
grant execute on function public.admin_apply_jurisdiction_dependency_change(uuid, uuid, text, date, text, uuid, uuid) to authenticated;

comment on function public.admin_preview_jurisdiction_dependency_change(uuid, uuid, text, date, text, uuid) is
  'Validates a proposed current-organigram dependency change and returns before/after context without writing.';

comment on function public.admin_apply_jurisdiction_dependency_change(uuid, uuid, text, date, text, uuid, uuid) is
  'Revalidates and atomically changes one jurisdiction dependency, preserving the previous edge, recording the operation effects and writing one audit event.';
