-- Create a jurisdiction as one atomic organizational operation.
-- Civil geography is intentionally excluded: jurisdiction coverage is modeled separately.

create or replace function public.admin_preview_jurisdiction_creation(
  p_entity_type_key text,
  p_name text,
  p_official_name text,
  p_latin_name text,
  p_slug text,
  p_parent_account_id uuid,
  p_relationship_type text,
  p_effective_date date default current_date,
  p_visibility text default 'internal',
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
  v_type public.entity_types%rowtype;
  v_parent public.jurisdiction_accounts%rowtype;
  v_parent_entity public.ecclesiastical_entities%rowtype;
  v_rule public.jurisdiction_account_type_rules%rowtype;
  v_errors jsonb := '[]'::jsonb;
begin
  if v_actor is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para crear jurisdicciones' using errcode = '42501';
  end if;

  select * into v_type
  from public.entity_types
  where key = nullif(btrim(p_entity_type_key), '') and status = 'active'
  limit 1;

  if v_type.id is null then
    v_errors := v_errors || jsonb_build_array('El tipo de jurisdicción no existe o no está activo.');
  elsif v_type.key = 'holy_see' then
    v_errors := v_errors || jsonb_build_array('La Santa Sede es la raíz única del plan jurisdiccional y no puede crearse desde este formulario.');
  end if;

  if nullif(btrim(p_name), '') is null then
    v_errors := v_errors || jsonb_build_array('El nombre es obligatorio.');
  end if;

  if nullif(btrim(p_slug), '') is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    v_errors := v_errors || jsonb_build_array('El slug es obligatorio y debe usar minúsculas, números y guiones.');
  elsif exists(select 1 from public.ecclesiastical_entities where slug = p_slug) then
    v_errors := v_errors || jsonb_build_array('Ya existe una entidad con ese slug.');
  end if;

  if p_visibility not in ('public','internal','private','confidential') then
    v_errors := v_errors || jsonb_build_array('La visibilidad seleccionada no es válida.');
  end if;

  if p_effective_date is null then
    v_errors := v_errors || jsonb_build_array('La fecha efectiva es obligatoria.');
  end if;

  if nullif(btrim(p_reason), '') is null then
    v_errors := v_errors || jsonb_build_array('Indica brevemente el motivo de la creación.');
  end if;

  select * into v_parent
  from public.jurisdiction_accounts
  where id = p_parent_account_id;

  if v_parent.id is null or not v_parent.is_current or v_parent.status <> 'active' then
    v_errors := v_errors || jsonb_build_array('La dependencia superior no existe o no está activa.');
  else
    select * into v_parent_entity
    from public.ecclesiastical_entities
    where id = v_parent.ecclesiastical_entity_id;
  end if;

  if v_type.id is not null and v_parent_entity.id is not null then
    select * into v_rule
    from public.jurisdiction_account_type_rules
    where parent_entity_type_id = v_parent_entity.entity_type_id
      and child_entity_type_id = v_type.id
      and relationship_type = nullif(btrim(p_relationship_type), '')
      and status = 'active'
      and is_allowed
    limit 1;

    if v_rule.id is null then
      v_errors := v_errors || jsonb_build_array('La relación entre el tipo de jurisdicción y su dependencia superior no está permitida.');
    elsif v_rule.requires_source and p_source_document_id is null then
      v_errors := v_errors || jsonb_build_array('Esta creación jurisdiccional requiere una fuente documental.');
    end if;
  end if;

  return jsonb_build_object(
    'valid', jsonb_array_length(v_errors) = 0,
    'errors', v_errors,
    'jurisdiction', jsonb_build_object(
      'entity_type_key', p_entity_type_key,
      'entity_type_name', v_type.name,
      'name', nullif(btrim(p_name), ''),
      'official_name', nullif(btrim(p_official_name), ''),
      'latin_name', nullif(btrim(p_latin_name), ''),
      'slug', p_slug,
      'effective_date', p_effective_date,
      'visibility', p_visibility
    ),
    'dependency', case when v_parent.id is null then null else jsonb_build_object(
      'parent_account_id', v_parent.id,
      'parent_name', v_parent_entity.name,
      'relationship_type', nullif(btrim(p_relationship_type), '')
    ) end,
    'requires_source', coalesce(v_rule.requires_source, false),
    'source_document_id', p_source_document_id
  );
end;
$$;

create or replace function public.admin_apply_jurisdiction_creation(
  p_entity_type_key text,
  p_name text,
  p_official_name text,
  p_latin_name text,
  p_slug text,
  p_parent_account_id uuid,
  p_relationship_type text,
  p_effective_date date,
  p_visibility text,
  p_reason text,
  p_source_document_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_preview jsonb;
  v_type public.entity_types%rowtype;
  v_parent public.jurisdiction_accounts%rowtype;
  v_entity_id uuid := gen_random_uuid();
  v_account_id uuid := gen_random_uuid();
  v_edge_id uuid;
  v_operation_id uuid;
  v_audit_id uuid;
  v_account_code text;
  v_account_state jsonb;
  v_edge_state jsonb;
begin
  if v_actor is null or not public.current_user_has_admin_role() then
    raise exception 'No autorizado para crear jurisdicciones' using errcode = '42501';
  end if;

  select * into v_parent
  from public.jurisdiction_accounts
  where id = p_parent_account_id
  for update;

  if not found then
    raise exception 'La dependencia superior no existe.' using errcode = 'P0002';
  end if;

  v_preview := public.admin_preview_jurisdiction_creation(
    p_entity_type_key, p_name, p_official_name, p_latin_name, p_slug,
    p_parent_account_id, p_relationship_type, p_effective_date,
    p_visibility, p_reason, p_source_document_id
  );

  if not coalesce((v_preview->>'valid')::boolean, false) then
    raise exception 'Creación jurisdiccional inválida: %', v_preview->'errors' using errcode = '22023';
  end if;

  select * into strict v_type
  from public.entity_types
  where key = btrim(p_entity_type_key) and status = 'active';

  -- Recheck the unique public identifier after locking the parent and immediately before insert.
  if exists(select 1 from public.ecclesiastical_entities where slug = p_slug) then
    raise exception 'Ya existe una entidad con ese slug. Recarga antes de confirmar.' using errcode = '40001';
  end if;

  insert into public.ecclesiastical_entities(
    id, entity_type_id, name, official_name, latin_name, slug,
    status, visibility, erected_at, source_name, created_by, created_at, updated_at
  ) values (
    v_entity_id, v_type.id, btrim(p_name), nullif(btrim(p_official_name), ''),
    nullif(btrim(p_latin_name), ''), p_slug,
    'active', p_visibility, p_effective_date,
    case when p_source_document_id is null then null else 'Documento fuente vinculado' end,
    v_actor, now(), now()
  );

  v_account_code := 'JUR-' || upper(replace(v_account_id::text, '-', ''));

  insert into public.jurisdiction_accounts(
    id, ecclesiastical_entity_id, account_code, canonical_status, sort_order,
    valid_from, is_current, status, visibility, source_document_id, notes, created_by
  ) values (
    v_account_id, v_entity_id, v_account_code, 'active', coalesce(v_type.default_level_order, 100),
    p_effective_date, true, 'active', p_visibility, p_source_document_id,
    nullif(btrim(p_reason), ''), v_actor
  );

  insert into public.jurisdiction_account_edges(
    parent_account_id, child_account_id, relationship_type, valid_from,
    is_current, status, visibility, source_document_id, notes, created_by
  ) values (
    p_parent_account_id, v_account_id, btrim(p_relationship_type), p_effective_date,
    true, 'active', case when v_parent.visibility = 'public' and p_visibility = 'public' then 'public' else 'internal' end,
    p_source_document_id, nullif(btrim(p_reason), ''), v_actor
  ) returning id into v_edge_id;

  v_account_state := jsonb_build_object(
    'account_id', v_account_id,
    'ecclesiastical_entity_id', v_entity_id,
    'account_code', v_account_code,
    'entity_type_key', v_type.key,
    'name', btrim(p_name),
    'slug', p_slug,
    'canonical_status', 'active',
    'valid_from', p_effective_date,
    'is_current', true,
    'status', 'active',
    'visibility', p_visibility,
    'source_document_id', p_source_document_id
  );

  v_edge_state := jsonb_build_object(
    'edge_id', v_edge_id,
    'parent_account_id', p_parent_account_id,
    'child_account_id', v_account_id,
    'relationship_type', btrim(p_relationship_type),
    'valid_from', p_effective_date,
    'is_current', true,
    'status', 'active',
    'source_document_id', p_source_document_id
  );

  insert into public.jurisdiction_change_operations(
    origin, status, publication_status, primary_account_id, effective_date,
    reason, source_document_id, operation_source, created_by, applied_by,
    created_at, applied_at, updated_at
  ) values (
    'organizational_change', 'applied', 'internal', v_account_id, p_effective_date,
    btrim(p_reason), p_source_document_id, 'admin_organigram', v_actor, v_actor,
    now(), now(), now()
  ) returning id into v_operation_id;

  insert into public.jurisdiction_change_operation_accounts(operation_id, account_id, role)
  values
    (v_operation_id, v_account_id, 'primary'),
    (v_operation_id, p_parent_account_id, 'destination');

  insert into public.jurisdiction_change_effects(
    operation_id, sequence, target_type, target_id, action, before_state, after_state, applied_at
  ) values
    (v_operation_id, 1, 'account', v_account_id, 'create_account', null, v_account_state, now()),
    (v_operation_id, 2, 'edge', v_edge_id, 'create_dependency', null, v_edge_state, now());

  v_audit_id := public.admin_write_audit_log(
    'jurisdiction.create',
    'jurisdiction_accounts',
    v_account_id,
    jsonb_build_object(
      'kind', 'organizational_change',
      'operation_id', v_operation_id,
      'reason', btrim(p_reason),
      'effective_date', p_effective_date,
      'source_document_id', p_source_document_id,
      'before', null,
      'after', jsonb_build_object('account', v_account_state, 'dependency', v_edge_state)
    )
  );

  return jsonb_build_object(
    'status', 'applied',
    'entity_id', v_entity_id,
    'account_id', v_account_id,
    'account_code', v_account_code,
    'edge_id', v_edge_id,
    'operation_id', v_operation_id,
    'audit_id', v_audit_id,
    'preview', v_preview
  );
end;
$$;

revoke execute on function public.admin_preview_jurisdiction_creation(text,text,text,text,text,uuid,text,date,text,text,uuid) from public, anon;
revoke execute on function public.admin_apply_jurisdiction_creation(text,text,text,text,text,uuid,text,date,text,text,uuid) from public, anon;
grant execute on function public.admin_preview_jurisdiction_creation(text,text,text,text,text,uuid,text,date,text,text,uuid) to authenticated;
grant execute on function public.admin_apply_jurisdiction_creation(text,text,text,text,text,uuid,text,date,text,text,uuid) to authenticated;
