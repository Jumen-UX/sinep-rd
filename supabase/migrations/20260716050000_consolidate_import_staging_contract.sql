create or replace function app_private.import_domain_staging_contract(p_import_type text)
returns jsonb
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select case p_import_type
    when 'personas' then jsonb_build_object(
      'required_fields', jsonb_build_array('tipo_persona','primer_nombre','primer_apellido'),
      'relation_fields', jsonb_build_object('entidad_actual','entity')
    )
    when 'parroquias' then jsonb_build_object(
      'required_fields', jsonb_build_array('pais_iso2','diocesis','nivel_padre','tipo_entidad','nombre'),
      'relation_fields', jsonb_build_object('diocesis','entity','nivel_padre','entity')
    )
    when 'asignaciones' then jsonb_build_object(
      'required_fields', jsonb_build_array('persona','cargo','entidad','fecha_inicio'),
      'relation_fields', jsonb_build_object('persona','person','cargo','office','entidad','entity')
    )
    when 'eventos' then jsonb_build_object(
      'required_fields', jsonb_build_array('tipo_evento','fecha_efectiva','entidad','descripcion'),
      'relation_fields', jsonb_build_object('entidad','entity')
    )
    else null
  end;
$function$;

create or replace function app_private.normalize_import_row_for_domain(
  p_import_type text,
  p_row jsonb
)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog','app_private'
as $function$
declare
  v_row jsonb;
  v_actual text;
begin
  if app_private.import_domain_staging_contract(p_import_type) is null then
    raise exception 'Tipo de importación no permitido.' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_row, '{}'::jsonb)) <> 'object' then
    raise exception 'La fila de importación debe ser un objeto.' using errcode = '22023';
  end if;

  v_row := app_private.normalize_import_row(p_row);

  if p_import_type = 'personas' then
    v_row := jsonb_set(v_row, '{tipo_persona}', to_jsonb(lower(coalesce(v_row->>'tipo_persona',''))), true);
    if v_row ? 'estado' then
      v_row := jsonb_set(v_row, '{estado}', to_jsonb(lower(v_row->>'estado')), true);
    end if;
    if v_row ? 'visibilidad' then
      v_row := jsonb_set(v_row, '{visibilidad}', to_jsonb(lower(v_row->>'visibilidad')), true);
    end if;
  elsif p_import_type = 'parroquias' then
    if v_row ? 'pais_iso2' then
      v_row := jsonb_set(v_row, '{pais_iso2}', to_jsonb(upper(v_row->>'pais_iso2')), true);
    end if;
    if v_row ? 'tipo_entidad' then
      v_row := jsonb_set(v_row, '{tipo_entidad}', to_jsonb(lower(v_row->>'tipo_entidad')), true);
    end if;
    if v_row ? 'visibilidad' then
      v_row := jsonb_set(v_row, '{visibilidad}', to_jsonb(lower(v_row->>'visibilidad')), true);
    end if;
  elsif p_import_type = 'asignaciones' and v_row ? 'actual' then
    v_actual := lower(v_row->>'actual');
    if v_actual in ('true','1','si','sí') then
      v_row := jsonb_set(v_row, '{actual}', '"true"'::jsonb, true);
    elsif v_actual in ('false','0','no') then
      v_row := jsonb_set(v_row, '{actual}', '"false"'::jsonb, true);
    end if;
  elsif p_import_type = 'eventos' and v_row ? 'tipo_evento' then
    v_row := jsonb_set(v_row, '{tipo_evento}', to_jsonb(lower(v_row->>'tipo_evento')), true);
  end if;

  return v_row;
end;
$function$;

create or replace function app_private.import_row_status_from_open_issues(p_row_id uuid)
returns text
language sql
stable
set search_path to 'pg_catalog','public'
as $function$
  select case
    when exists (
      select 1 from public.import_batch_row_issues issue
      where issue.row_id = p_row_id and issue.status = 'open' and issue.issue_type = 'validation_error'
    ) then 'error'
    when exists (
      select 1 from public.import_batch_row_issues issue
      where issue.row_id = p_row_id and issue.status = 'open' and issue.issue_type = 'duplicate'
    ) then 'duplicate'
    when exists (
      select 1 from public.import_batch_row_issues issue
      where issue.row_id = p_row_id and issue.status = 'open' and issue.issue_type = 'unresolved_relation'
    ) then 'unresolved'
    when exists (
      select 1 from public.import_batch_row_issues issue
      where issue.row_id = p_row_id and issue.status = 'open' and issue.issue_type = 'warning'
    ) then 'warning'
    else 'valid'
  end;
$function$;

create or replace function app_private.admin_prepare_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_batch_id uuid;
  v_scope_entity_id uuid := nullif(payload ->> 'scope_entity_id', '')::uuid;
  v_import_type text := nullif(btrim(payload ->> 'import_type'), '');
  v_file jsonb := coalesce(payload -> 'file', '{}'::jsonb);
  v_rows jsonb := coalesce(payload -> 'rows', '[]'::jsonb);
  v_row jsonb;
  v_normalized_row jsonb;
  v_row_count integer;
  v_ordinality bigint;
  v_summary jsonb;
  v_audit_log_id uuid;
begin
  if v_actor_id is null then
    raise exception 'No autenticado para preparar importaciones.' using errcode = '42501';
  end if;
  if not public.current_user_has_permission('imports.prepare') and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para preparar importaciones.' using errcode = '42501';
  end if;
  if app_private.import_domain_staging_contract(v_import_type) is null then
    raise exception 'Tipo de importación no permitido.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_file) <> 'object' or jsonb_typeof(v_rows) <> 'array' then
    raise exception 'El archivo o las filas de importación son inválidos.' using errcode = '22023';
  end if;
  v_row_count := jsonb_array_length(v_rows);
  if v_row_count = 0 or v_row_count > 5000 then
    raise exception 'El lote debe contener entre 1 y 5,000 filas.' using errcode = '22023';
  end if;
  if nullif(btrim(v_file ->> 'name'), '') is null
     or lower(coalesce(v_file ->> 'extension', '')) <> 'csv'
     or coalesce((v_file ->> 'size_bytes')::bigint, -1) < 0
     or coalesce((v_file ->> 'size_bytes')::bigint, 10485761) > 10485760
     or lower(coalesce(v_file ->> 'sha256', '')) !~ '^[0-9a-f]{64}$' then
    raise exception 'Los metadatos obligatorios del archivo no son válidos.' using errcode = '22023';
  end if;
  if v_scope_entity_id is null and not public.current_user_is_super_or_national() then
    select public.current_user_root_jurisdiction_id() into v_scope_entity_id;
  end if;
  if v_scope_entity_id is null and not public.current_user_is_super_or_national() then
    raise exception 'Debes preparar el lote dentro de una jurisdicción asignada.' using errcode = '42501';
  end if;
  if v_scope_entity_id is not null and not public.current_user_can_manage_entity('imports.prepare', v_scope_entity_id) then
    raise exception 'La jurisdicción del lote está fuera de tu alcance.' using errcode = '42501';
  end if;

  insert into public.import_batches (
    import_type, status, template_version, file_name, file_extension, file_mime_type,
    file_size_bytes, file_sha256, file_last_modified_at, source_metadata,
    scope_entity_id, created_by, row_count
  ) values (
    v_import_type, 'prepared', coalesce((payload ->> 'template_version')::integer, 1),
    btrim(v_file ->> 'name'), 'csv', nullif(btrim(v_file ->> 'mime_type'), ''),
    (v_file ->> 'size_bytes')::bigint, lower(v_file ->> 'sha256'),
    nullif(v_file ->> 'last_modified_at', '')::timestamptz,
    coalesce(payload -> 'source_metadata', '{}'::jsonb), v_scope_entity_id, v_actor_id, v_row_count
  ) returning id into v_batch_id;

  for v_row, v_ordinality in
    select element.value, element.ordinality
    from jsonb_array_elements(v_rows) with ordinality element(value, ordinality)
  loop
    v_normalized_row := app_private.normalize_import_row_for_domain(v_import_type, v_row);
    insert into public.import_batch_rows (batch_id, row_number, raw_data, normalized_data, row_hash)
    values (v_batch_id, v_ordinality::integer, v_row, v_normalized_row, md5(v_normalized_row::text));
  end loop;

  v_summary := app_private.validate_import_batch_with_contract(v_batch_id);
  v_audit_log_id := public.admin_write_audit_log(
    'import.batch.prepared', 'import_batches', v_batch_id,
    jsonb_build_object(
      'import_type', v_import_type, 'file_name', v_file ->> 'name',
      'file_sha256', lower(v_file ->> 'sha256'), 'row_count', v_row_count,
      'scope_entity_id', v_scope_entity_id, 'validation', v_summary,
      'canonical_records_modified', false
    )
  );
  return v_summary || jsonb_build_object('audit_log_id', v_audit_log_id);
end;
$function$;

create or replace function app_private.admin_update_import_batch_row(p_row_id uuid, p_normalized_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_batch_id uuid;
  v_batch_status text;
  v_import_type text;
  v_scope_entity_id uuid;
  v_normalized_row jsonb;
  v_summary jsonb;
  v_audit_log_id uuid;
begin
  if v_actor_id is null then
    raise exception 'No autenticado para corregir importaciones.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_normalized_data, '{}'::jsonb)) <> 'object' then
    raise exception 'La corrección de la fila debe ser un objeto.' using errcode = '22023';
  end if;
  select batch.id, batch.status, batch.import_type, batch.scope_entity_id
    into v_batch_id, v_batch_status, v_import_type, v_scope_entity_id
  from public.import_batch_rows row_data
  join public.import_batches batch on batch.id = row_data.batch_id
  where row_data.id = p_row_id
  for update of row_data, batch;
  if v_batch_id is null then
    raise exception 'La fila de importación no existe.' using errcode = 'P0002';
  end if;
  if not public.current_user_has_permission('imports.prepare') and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para corregir importaciones.' using errcode = '42501';
  end if;
  if v_scope_entity_id is not null and not public.current_user_can_manage_entity('imports.prepare', v_scope_entity_id) then
    raise exception 'La fila está fuera de tu alcance administrativo.' using errcode = '42501';
  end if;
  if v_batch_status in ('applying', 'applied', 'cancelled') then
    raise exception 'El lote ya no admite correcciones.' using errcode = '22023';
  end if;
  v_normalized_row := app_private.normalize_import_row_for_domain(v_import_type, p_normalized_data);
  update public.import_batch_rows
  set normalized_data = v_normalized_row,
      row_hash = md5(v_normalized_row::text),
      status = 'pending',
      corrected_by = v_actor_id,
      corrected_at = now(),
      updated_at = now()
  where id = p_row_id;
  v_summary := app_private.validate_import_batch_with_contract(v_batch_id);
  v_audit_log_id := public.admin_write_audit_log(
    'import.batch.row.corrected', 'import_batch_rows', p_row_id,
    jsonb_build_object('batch_id', v_batch_id, 'validation', v_summary, 'canonical_records_modified', false)
  );
  return v_summary || jsonb_build_object('row_id', p_row_id, 'audit_log_id', v_audit_log_id);
end;
$function$;

revoke all on function app_private.import_domain_staging_contract(text) from public, anon, authenticated;
revoke all on function app_private.normalize_import_row_for_domain(text, jsonb) from public, anon, authenticated;
revoke all on function app_private.import_row_status_from_open_issues(uuid) from public, anon, authenticated;
