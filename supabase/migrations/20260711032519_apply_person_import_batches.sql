-- Apply approved person-import batches through the canonical registration engine.
-- The generic dispatcher is intentionally limited to personas in this migration.

begin;

insert into public.permissions (key, module, description)
values (
  'imports.apply',
  'imports',
  'Aplicar lotes de importación aprobados mediante contratos canónicos transaccionales e idempotentes.'
)
on conflict (key) do update
set module = excluded.module,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select role_row.id, permission_row.id
from public.roles role_row
cross join public.permissions permission_row
where role_row.key in ('super_admin', 'national_admin', 'diocesan_admin')
  and permission_row.key = 'imports.apply'
on conflict do nothing;

alter table public.import_batches
  add column if not exists application_summary jsonb not null default '{}'::jsonb,
  add column if not exists application_started_at timestamptz,
  add column if not exists application_attempt_count integer not null default 0;

alter table public.import_batches
  drop constraint if exists import_batches_application_summary_object_check,
  drop constraint if exists import_batches_application_attempt_count_check;

alter table public.import_batches
  add constraint import_batches_application_summary_object_check
    check (jsonb_typeof(application_summary) = 'object'),
  add constraint import_batches_application_attempt_count_check
    check (application_attempt_count >= 0);

create index if not exists idx_import_batches_application_state
  on public.import_batches (import_type, review_status, status, created_at desc);

create or replace function app_private.finalize_person_import_validation(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_batch public.import_batches%rowtype;
  v_valid_rows integer;
  v_warning_rows integer;
  v_error_rows integer;
  v_duplicate_rows integer;
  v_unresolved_rows integer;
  v_status text;
  v_summary jsonb;
begin
  select * into v_batch
  from public.import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  if v_batch.import_type <> 'personas' then
    return v_batch.validation_summary;
  end if;

  insert into public.import_batch_row_issues (
    batch_id, row_id, issue_type, code, field_name, message, details
  )
  select
    row_data.batch_id,
    row_data.id,
    'validation_error',
    'invalid_person_status_for_type',
    'estado',
    'El estado no es compatible con el tipo de persona para la aplicación canónica.',
    jsonb_build_object(
      'person_type', lower(coalesce(row_data.normalized_data ->> 'tipo_persona', '')),
      'received', lower(coalesce(row_data.normalized_data ->> 'estado', ''))
    )
  from public.import_batch_rows row_data
  where row_data.batch_id = p_batch_id
    and nullif(lower(btrim(coalesce(row_data.normalized_data ->> 'estado', ''))), '') is not null
    and not (
      (
        lower(btrim(row_data.normalized_data ->> 'tipo_persona')) in ('bishop', 'priest', 'deacon')
        and lower(btrim(row_data.normalized_data ->> 'estado')) in (
          'active', 'retired', 'emeritus', 'suspended', 'inactive', 'unknown'
        )
      )
      or (
        lower(btrim(row_data.normalized_data ->> 'tipo_persona')) = 'religious'
        and lower(btrim(row_data.normalized_data ->> 'estado')) in (
          'active', 'retired', 'transferred', 'unknown'
        )
      )
      or (
        lower(btrim(row_data.normalized_data ->> 'tipo_persona')) = 'layperson'
        and lower(btrim(row_data.normalized_data ->> 'estado')) in (
          'active', 'retired', 'transferred', 'inactive', 'suspended', 'unknown'
        )
      )
    );

  insert into public.import_batch_row_issues (
    batch_id, row_id, issue_type, code, field_name, message, details
  )
  select
    row_data.batch_id,
    row_data.id,
    'validation_error',
    'invalid_person_visibility',
    'visibilidad',
    'La visibilidad debe ser public, internal, private o confidential.',
    jsonb_build_object('received', lower(coalesce(row_data.normalized_data ->> 'visibilidad', '')))
  from public.import_batch_rows row_data
  where row_data.batch_id = p_batch_id
    and nullif(lower(btrim(coalesce(row_data.normalized_data ->> 'visibilidad', ''))), '') is not null
    and lower(btrim(row_data.normalized_data ->> 'visibilidad')) not in (
      'public', 'internal', 'private', 'confidential'
    );

  update public.import_batch_rows row_data
  set status = case
        when exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id and issue.status = 'open'
            and issue.issue_type = 'validation_error'
        ) then 'error'
        when exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id and issue.status = 'open'
            and issue.issue_type = 'duplicate'
        ) then 'duplicate'
        when exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id and issue.status = 'open'
            and issue.issue_type = 'unresolved_relation'
        ) then 'unresolved'
        when exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id and issue.status = 'open'
            and issue.issue_type = 'warning'
        ) then 'warning'
        else 'valid'
      end,
      target_operation = case
        when not exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id and issue.status = 'open'
            and issue.issue_type in ('validation_error', 'duplicate', 'unresolved_relation')
        ) then 'create' else null end,
      target_schema = case
        when not exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id and issue.status = 'open'
            and issue.issue_type in ('validation_error', 'duplicate', 'unresolved_relation')
        ) then 'public' else null end,
      target_table = case
        when not exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id and issue.status = 'open'
            and issue.issue_type in ('validation_error', 'duplicate', 'unresolved_relation')
        ) then 'persons' else null end,
      target_record_id = null,
      applied_at = null,
      updated_at = now()
  where row_data.batch_id = p_batch_id;

  select
    count(*) filter (where status = 'valid'),
    count(*) filter (where status = 'warning'),
    count(*) filter (where status = 'error'),
    count(*) filter (where status = 'duplicate'),
    count(*) filter (where status = 'unresolved')
  into v_valid_rows, v_warning_rows, v_error_rows, v_duplicate_rows, v_unresolved_rows
  from public.import_batch_rows
  where batch_id = p_batch_id;

  v_status := case
    when v_error_rows + v_duplicate_rows + v_unresolved_rows > 0 then 'needs_review'
    else 'validated'
  end;

  v_summary := jsonb_build_object(
    'batch_id', p_batch_id,
    'status', v_status,
    'row_count', v_batch.row_count,
    'valid_rows', v_valid_rows,
    'warning_rows', v_warning_rows,
    'error_rows', v_error_rows,
    'duplicate_rows', v_duplicate_rows,
    'unresolved_rows', v_unresolved_rows,
    'review_status', 'pending',
    'can_apply', false,
    'application_domain', 'personas',
    'application_rpc_available', true
  );

  update public.import_batches
  set status = v_status,
      valid_rows = v_valid_rows,
      warning_rows = v_warning_rows,
      error_rows = v_error_rows,
      duplicate_rows = v_duplicate_rows,
      unresolved_rows = v_unresolved_rows,
      validation_summary = v_summary,
      application_summary = '{}'::jsonb,
      last_error = null,
      application_started_at = null,
      applied_by = null,
      applied_rows = 0,
      applied_at = null,
      updated_at = now()
  where id = p_batch_id;

  return v_summary;
end;
$$;

revoke all on function app_private.finalize_person_import_validation(uuid)
  from public, anon, authenticated;

create or replace function app_private.validate_import_batch_with_contract(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_summary jsonb;
  v_import_type text;
begin
  v_summary := app_private.validate_import_batch(p_batch_id);
  select import_type into v_import_type
  from public.import_batches where id = p_batch_id;
  if v_import_type = 'personas' then
    return app_private.finalize_person_import_validation(p_batch_id);
  end if;
  return v_summary;
end;
$$;

revoke all on function app_private.validate_import_batch_with_contract(uuid)
  from public, anon;
grant execute on function app_private.validate_import_batch_with_contract(uuid)
  to authenticated;

create or replace function app_private.admin_prepare_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
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
  if v_import_type not in ('personas', 'parroquias', 'asignaciones', 'eventos') then
    raise exception 'Tipo de importación no permitido.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_file) <> 'object' then
    raise exception 'Los metadatos del archivo son inválidos.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_rows) <> 'array' then
    raise exception 'Las filas de importación deben enviarse como una lista.' using errcode = '22023';
  end if;
  v_row_count := jsonb_array_length(v_rows);
  if v_row_count = 0 then
    raise exception 'El archivo no contiene filas para importar.' using errcode = '22023';
  end if;
  if v_row_count > 5000 then
    raise exception 'El lote supera el límite inicial de 5,000 filas.' using errcode = '22023';
  end if;
  if nullif(btrim(v_file ->> 'name'), '') is null
     or lower(coalesce(v_file ->> 'extension', '')) not in ('csv', 'xlsx', 'xls')
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
    btrim(v_file ->> 'name'), lower(v_file ->> 'extension'), nullif(btrim(v_file ->> 'mime_type'), ''),
    (v_file ->> 'size_bytes')::bigint, lower(v_file ->> 'sha256'),
    nullif(v_file ->> 'last_modified_at', '')::timestamptz,
    coalesce(payload -> 'source_metadata', '{}'::jsonb), v_scope_entity_id, v_actor_id, v_row_count
  ) returning id into v_batch_id;

  for v_row, v_ordinality in
    select element.value, element.ordinality
    from jsonb_array_elements(v_rows) with ordinality element(value, ordinality)
  loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'La fila % debe ser un objeto de columnas y valores.', v_ordinality using errcode = '22023';
    end if;
    v_normalized_row := app_private.normalize_import_row(v_row);
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
$$;

create or replace function app_private.admin_update_import_batch_row(p_row_id uuid, p_normalized_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_batch_id uuid;
  v_batch_status text;
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
  select batch.id, batch.status, batch.scope_entity_id
    into v_batch_id, v_batch_status, v_scope_entity_id
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
  v_normalized_row := app_private.normalize_import_row(p_normalized_data);
  update public.import_batch_rows
  set normalized_data = v_normalized_row, row_hash = md5(v_normalized_row::text),
      status = 'pending', corrected_by = v_actor_id, corrected_at = now(), updated_at = now()
  where id = p_row_id;
  v_summary := app_private.validate_import_batch_with_contract(v_batch_id);
  v_audit_log_id := public.admin_write_audit_log(
    'import.batch.row.corrected', 'import_batch_rows', p_row_id,
    jsonb_build_object('batch_id', v_batch_id, 'validation', v_summary, 'canonical_records_modified', false)
  );
  return v_summary || jsonb_build_object('row_id', p_row_id, 'audit_log_id', v_audit_log_id);
end;
$$;

create or replace function public.admin_validate_import_batch(p_batch_id uuid)
returns jsonb
language sql
security invoker
set search_path = public, app_private, auth, pg_temp
as $$
  select app_private.validate_import_batch_with_contract(p_batch_id);
$$;

revoke all on function public.admin_validate_import_batch(uuid) from public, anon;
grant execute on function public.admin_validate_import_batch(uuid) to authenticated;

create or replace function app_private.admin_apply_import_batch(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, internal, auth, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_batch_id uuid := nullif(payload ->> 'batch_id', '')::uuid;
  v_batch public.import_batches%rowtype;
  v_row public.import_batch_rows%rowtype;
  v_result jsonb;
  v_person_id uuid;
  v_entity_id uuid;
  v_person_type text;
  v_person_status text;
  v_visibility text;
  v_canonical_status text;
  v_after_data jsonb;
  v_row_audit_log_id uuid;
  v_batch_audit_log_id uuid;
  v_applied_rows integer := 0;
  v_summary jsonb;
  v_failure_message text;
  v_failure_state text;
begin
  if v_actor_id is null then
    raise exception 'No autenticado para aplicar importaciones.' using errcode = '42501';
  end if;
  if not public.current_user_has_permission('imports.apply') and not public.current_user_is_super_or_national() then
    raise exception 'No autorizado para aplicar importaciones.' using errcode = '42501';
  end if;
  if v_batch_id is null then
    raise exception 'El lote de importación es obligatorio.' using errcode = '22023';
  end if;
  select * into v_batch from public.import_batches where id = v_batch_id for update;
  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;
  if v_batch.import_type <> 'personas' then
    raise exception 'La aplicación canónica está disponible actualmente solo para lotes de personas.' using errcode = '0A000';
  end if;
  if v_batch.scope_entity_id is not null and not public.current_user_can_manage_entity('imports.apply', v_batch.scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance de aplicación.' using errcode = '42501';
  end if;
  if v_batch.status = 'applied' then
    return jsonb_build_object(
      'batch_id', v_batch.id, 'status', 'applied', 'review_status', v_batch.review_status,
      'row_count', v_batch.row_count, 'applied_rows', v_batch.applied_rows,
      'can_apply', false, 'application_rpc_available', true, 'idempotent_replay', true,
      'application_summary', v_batch.application_summary, 'applied_at', v_batch.applied_at
    );
  end if;
  if v_batch.status = 'applying' then
    raise exception 'El lote ya está siendo aplicado.' using errcode = '55000';
  end if;
  if v_batch.status not in ('validated', 'failed') then
    raise exception 'El lote debe estar validado antes de aplicarse.' using errcode = '22023';
  end if;
  if v_batch.review_status <> 'approved' or v_batch.reviewed_by is null or v_batch.reviewed_at is null then
    raise exception 'El lote requiere aprobación editorial vigente antes de aplicarse.' using errcode = '22023';
  end if;
  if v_batch.error_rows + v_batch.duplicate_rows + v_batch.unresolved_rows > 0
     or exists (
       select 1 from public.import_batch_row_issues issue
       where issue.batch_id = v_batch.id and issue.status = 'open'
         and issue.issue_type in ('validation_error', 'duplicate', 'unresolved_relation')
     ) then
    raise exception 'El lote mantiene incidencias bloqueantes.' using errcode = '22023';
  end if;
  if (select count(*) from public.import_batch_rows row_data where row_data.batch_id = v_batch.id) <> v_batch.row_count then
    raise exception 'La cantidad de filas persistidas no coincide con el resumen del lote.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.import_batch_rows row_data
    where row_data.batch_id = v_batch.id
      and (
        row_data.status not in ('valid', 'warning') or row_data.target_operation <> 'create'
        or row_data.target_schema <> 'public' or row_data.target_table <> 'persons'
        or row_data.target_record_id is not null or row_data.applied_at is not null
      )
  ) or exists (select 1 from public.import_batch_changes change_row where change_row.batch_id = v_batch.id) then
    raise exception 'El lote presenta un estado parcial o inconsistente y no puede aplicarse.' using errcode = '55000';
  end if;

  update public.import_batches
  set status = 'applying', application_started_at = now(),
      application_attempt_count = application_attempt_count + 1,
      application_summary = jsonb_build_object('status', 'applying', 'domain', 'personas', 'contract_version', 1, 'started_at', now()),
      last_error = null, updated_at = now()
  where id = v_batch.id;

  begin
    for v_row in
      select * from public.import_batch_rows where batch_id = v_batch.id order by row_number for update
    loop
      v_person_type := lower(btrim(v_row.normalized_data ->> 'tipo_persona'));
      v_person_status := coalesce(nullif(lower(btrim(v_row.normalized_data ->> 'estado')), ''), 'active');
      v_visibility := coalesce(nullif(lower(btrim(v_row.normalized_data ->> 'visibilidad')), ''), 'public');
      v_entity_id := coalesce(nullif(v_row.resolved_relations ->> 'entidad_actual', '')::uuid, v_batch.scope_entity_id);
      v_canonical_status := case
        when v_person_type = 'religious' then case v_person_status
          when 'active' then 'active' when 'retired' then 'retired' when 'transferred' then 'transferred' else 'unknown' end
        when v_person_type in ('bishop', 'priest', 'deacon') then case v_person_status
          when 'active' then 'active' when 'retired' then 'retired' when 'emeritus' then 'emeritus'
          when 'suspended' then 'suspended' when 'inactive' then 'inactive' else 'unknown' end
        else 'active' end;

      v_result := internal.admin_save_canonical_person(jsonb_strip_nulls(jsonb_build_object(
        'flow', v_person_type, 'mode', 'new',
        'first_name', nullif(btrim(v_row.normalized_data ->> 'primer_nombre'), ''),
        'middle_name', nullif(btrim(v_row.normalized_data ->> 'segundo_nombre'), ''),
        'last_name', nullif(btrim(v_row.normalized_data ->> 'primer_apellido'), ''),
        'second_last_name', nullif(btrim(v_row.normalized_data ->> 'segundo_apellido'), ''),
        'display_name', nullif(btrim(v_row.normalized_data ->> 'nombre_publico'), ''),
        'visibility', v_visibility, 'current_service_entity_id', v_entity_id,
        'clerical_status', v_canonical_status, 'religious_canonical_status', v_canonical_status,
        'canonical_status', v_canonical_status,
        'source_name', coalesce(nullif(btrim(v_row.normalized_data ->> 'fuente'), ''), v_batch.file_name),
        'source_url', nullif(btrim(v_row.normalized_data ->> 'url_fuente'), ''),
        'verification_status', 'pending_review',
        'notes_internal', format('Creado por el lote de importación %s, fila %s.', v_batch.id, v_row.row_number),
        'not_identified_fields', jsonb_build_array(
          'gender', 'birth_date', 'birth_place', 'biography_public', 'diaconal_ordination_date',
          'priestly_ordination_date', 'incardination_entity_id', 'community_name', 'profession_date'
        )
      )));

      v_person_id := nullif(v_result ->> 'person_id', '')::uuid;
      if v_person_id is null then
        raise exception 'El motor canónico no devolvió la persona creada para la fila %.', v_row.row_number using errcode = 'P0001';
      end if;
      update public.persons set status = v_person_status, updated_at = now() where id = v_person_id;
      select jsonb_build_object(
        'person_id', person_state.id, 'display_name', person_state.display_name, 'slug', person_state.slug,
        'status', person_state.status, 'visibility', person_state.visibility,
        'effective_person_type', person_state.effective_person_type,
        'clergy_profile_id', v_result ->> 'clergy_profile_id',
        'religious_profile_id', v_result ->> 'religious_profile_id'
      ) into v_after_data
      from public.person_ecclesial_state person_state where person_state.id = v_person_id;
      v_row_audit_log_id := public.admin_write_audit_log(
        'import.person.created', 'persons', v_person_id,
        jsonb_build_object(
          'batch_id', v_batch.id, 'row_id', v_row.id, 'row_number', v_row.row_number,
          'person_type', v_person_type, 'scope_entity_id', v_batch.scope_entity_id,
          'file_sha256', v_batch.file_sha256, 'canonical_records_modified', true
        )
      );
      insert into public.import_batch_changes (
        batch_id, row_id, operation, target_schema, target_table, target_record_id, before_data, after_data, audit_log_id
      ) values (v_batch.id, v_row.id, 'create', 'public', 'persons', v_person_id, null, v_after_data, v_row_audit_log_id);
      update public.import_batch_rows
      set status = 'applied', target_operation = 'create', target_schema = 'public', target_table = 'persons',
          target_record_id = v_person_id, applied_at = now(), updated_at = now()
      where id = v_row.id;
      v_applied_rows := v_applied_rows + 1;
    end loop;

    v_summary := jsonb_build_object(
      'batch_id', v_batch.id, 'status', 'applied', 'review_status', v_batch.review_status,
      'row_count', v_batch.row_count, 'applied_rows', v_applied_rows, 'domain', 'personas',
      'contract_version', 1, 'can_apply', false, 'application_rpc_available', true,
      'idempotent_replay', false, 'applied_at', now()
    );
    update public.import_batches
    set status = 'applied', applied_by = v_actor_id, applied_rows = v_applied_rows,
        application_summary = v_summary, last_error = null, applied_at = now(), updated_at = now()
    where id = v_batch.id;
    v_batch_audit_log_id := public.admin_write_audit_log(
      'import.batch.applied', 'import_batches', v_batch.id,
      jsonb_build_object(
        'import_type', v_batch.import_type, 'row_count', v_batch.row_count, 'applied_rows', v_applied_rows,
        'scope_entity_id', v_batch.scope_entity_id, 'file_sha256', v_batch.file_sha256,
        'contract_version', 1, 'canonical_records_modified', true
      )
    );
    return v_summary || jsonb_build_object('audit_log_id', v_batch_audit_log_id);
  exception when others then
    get stacked diagnostics v_failure_message = message_text, v_failure_state = returned_sqlstate;
  end;

  v_summary := jsonb_build_object(
    'batch_id', v_batch.id, 'status', 'failed', 'review_status', v_batch.review_status,
    'row_count', v_batch.row_count, 'applied_rows', 0, 'domain', 'personas', 'contract_version', 1,
    'can_apply', true, 'application_rpc_available', true, 'idempotent_replay', false,
    'error', v_failure_message, 'sqlstate', v_failure_state
  );
  update public.import_batches
  set status = 'failed', applied_by = null, applied_rows = 0, application_summary = v_summary,
      last_error = v_failure_message, applied_at = null, updated_at = now()
  where id = v_batch.id;
  v_batch_audit_log_id := public.admin_write_audit_log(
    'import.batch.application_failed', 'import_batches', v_batch.id,
    jsonb_build_object(
      'import_type', v_batch.import_type, 'row_count', v_batch.row_count,
      'scope_entity_id', v_batch.scope_entity_id, 'file_sha256', v_batch.file_sha256,
      'contract_version', 1, 'sqlstate', v_failure_state, 'canonical_records_modified', false
    )
  );
  return v_summary || jsonb_build_object('audit_log_id', v_batch_audit_log_id);
end;
$$;

revoke all on function app_private.admin_apply_import_batch(jsonb) from public, anon;
grant execute on function app_private.admin_apply_import_batch(jsonb) to authenticated;

create or replace function public.admin_apply_import_batch(payload jsonb)
returns jsonb
language sql
security invoker
set search_path = public, app_private, auth, pg_temp
as $$
  select app_private.admin_apply_import_batch(payload);
$$;

revoke all on function public.admin_apply_import_batch(jsonb) from public, anon;
grant execute on function public.admin_apply_import_batch(jsonb) to authenticated;

comment on column public.import_batches.application_summary is
  'Outcome of the last canonical application attempt. It excludes private row payloads.';
comment on column public.import_batches.application_attempt_count is
  'Number of canonical application attempts, including failed attempts.';
comment on function public.admin_apply_import_batch(jsonb) is
  'Applies an approved import batch through its canonical domain contract. Version 1 supports personas only.';

commit;