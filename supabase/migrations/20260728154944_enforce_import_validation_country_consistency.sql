create or replace function app_private.refresh_import_batch_validation_summary(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_batch public.import_batches%rowtype;
  v_valid integer;
  v_warning integer;
  v_error integer;
  v_duplicate integer;
  v_unresolved integer;
  v_status text;
  v_summary jsonb;
begin
  select * into v_batch
  from public.import_batches batch
  where batch.id = p_batch_id
  for update;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  update public.import_batch_rows row_data
  set status = case
        when exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id and issue.status = 'open' and issue.issue_type = 'validation_error'
        ) then 'error'
        when exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id and issue.status = 'open' and issue.issue_type = 'duplicate'
        ) then 'duplicate'
        when exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id and issue.status = 'open' and issue.issue_type = 'unresolved_relation'
        ) then 'unresolved'
        when exists (
          select 1 from public.import_batch_row_issues issue
          where issue.row_id = row_data.id and issue.status = 'open' and issue.issue_type = 'warning'
        ) then 'warning'
        else 'valid'
      end,
      updated_at = now()
  where row_data.batch_id = p_batch_id;

  select
    count(*) filter (where status = 'valid'),
    count(*) filter (where status = 'warning'),
    count(*) filter (where status = 'error'),
    count(*) filter (where status = 'duplicate'),
    count(*) filter (where status = 'unresolved')
  into v_valid, v_warning, v_error, v_duplicate, v_unresolved
  from public.import_batch_rows
  where batch_id = p_batch_id;

  v_status := case
    when v_error + v_duplicate + v_unresolved > 0 then 'needs_review'
    else 'validated'
  end;

  v_summary := coalesce(v_batch.validation_summary, '{}'::jsonb) || jsonb_build_object(
    'batch_id', p_batch_id,
    'status', v_status,
    'row_count', v_batch.row_count,
    'valid_rows', v_valid,
    'warning_rows', v_warning,
    'error_rows', v_error,
    'duplicate_rows', v_duplicate,
    'unresolved_rows', v_unresolved
  );

  update public.import_batches
  set status = v_status,
      valid_rows = v_valid,
      warning_rows = v_warning,
      error_rows = v_error,
      duplicate_rows = v_duplicate,
      unresolved_rows = v_unresolved,
      validation_summary = v_summary,
      updated_at = now()
  where id = p_batch_id;

  return v_summary;
end;
$$;

create or replace function app_private.enforce_structure_import_country_consistency(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_batch public.import_batches%rowtype;
  v_country char(2);
begin
  select * into v_batch
  from public.import_batches batch
  where batch.id = p_batch_id
  for update;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  if v_batch.import_type <> 'parroquias' then
    return v_batch.validation_summary;
  end if;

  v_country := app_private.resolve_entity_country_iso2(v_batch.scope_entity_id);
  if v_country is null then
    raise exception 'No se pudo resolver el país del lote.' using errcode = '22023';
  end if;

  insert into public.import_batch_row_issues(
    batch_id,row_id,issue_type,code,field_name,message,details
  )
  select
    p_batch_id,
    row_data.id,
    'validation_error',
    'structure_country_mismatch',
    'pais_iso2',
    'El país de la fila debe coincidir con el país administrativo del lote.',
    jsonb_build_object('expected_country', v_country)
  from public.import_batch_rows row_data
  where row_data.batch_id = p_batch_id
    and upper(coalesce(row_data.normalized_data->>'pais_iso2','')) <> v_country::text
    and not exists (
      select 1 from public.import_batch_row_issues issue
      where issue.row_id = row_data.id
        and issue.status = 'open'
        and issue.code = 'structure_country_mismatch'
    );

  update public.import_batch_rows row_data
  set target_operation = null,
      target_schema = null,
      target_table = null,
      target_record_id = null,
      updated_at = now()
  where row_data.batch_id = p_batch_id
    and upper(coalesce(row_data.normalized_data->>'pais_iso2','')) <> v_country::text;

  return app_private.refresh_import_batch_validation_summary(p_batch_id);
end;
$$;

create or replace function app_private.promote_person_reference_matches_to_noop(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_batch public.import_batches%rowtype;
  v_row public.import_batch_rows%rowtype;
  v_candidates uuid[];
  v_match jsonb;
  v_target_id uuid;
  v_batch_country char(2);
  v_reference_exists boolean;
begin
  select * into v_batch
  from public.import_batches batch
  where batch.id = p_batch_id
  for update;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;
  if v_batch.import_type <> 'personas' then
    return v_batch.validation_summary;
  end if;

  v_batch_country := app_private.resolve_entity_country_iso2(v_batch.scope_entity_id);
  if v_batch_country is null then
    raise exception 'No se pudo resolver el país del lote.' using errcode = '22023';
  end if;

  for v_row in
    select * from public.import_batch_rows
    where batch_id = p_batch_id
    order by row_number
  loop
    if nullif(btrim(v_row.normalized_data->>'codigo_referencia'),'') is null then
      continue;
    end if;

    select exists (
      select 1
      from public.person_private_validation ppv
      where lower(btrim(ppv.internal_reference_code)) = lower(btrim(v_row.normalized_data->>'codigo_referencia'))
    ) into v_reference_exists;

    select coalesce(array_agg(distinct ppv.person_id order by ppv.person_id), '{}'::uuid[])
    into v_candidates
    from public.person_private_validation ppv
    where lower(btrim(ppv.internal_reference_code)) = lower(btrim(v_row.normalized_data->>'codigo_referencia'))
      and exists (
        select 1
        from app_private.person_scope_entities(ppv.person_id) person_scope
        where app_private.resolve_entity_country_iso2(person_scope.entity_id) = v_batch_country
          and app_private.current_user_can_manage_entity('imports.prepare', person_scope.entity_id)
      );

    v_match := app_private.classify_import_match_candidates(v_candidates);

    if v_match->>'status' = 'exact' then
      v_target_id := nullif(v_match->>'selected_id','')::uuid;

      update public.import_batch_row_issues
      set status = 'resolved',
          resolved_by = auth.uid(),
          resolved_at = now(),
          resolution_notes = 'Coincidencia exacta por código interno dentro del país del lote.'
      where row_id = v_row.id
        and status = 'open'
        and issue_type in ('duplicate','warning','unresolved_relation');

      update public.import_batch_rows
      set status = 'valid',
          target_operation = 'noop',
          target_schema = 'public',
          target_table = 'persons',
          target_record_id = v_target_id,
          resolved_relations = resolved_relations || jsonb_build_object(
            'match_status','exact',
            'noop_reason','exact_internal_reference_match',
            'matched_person_id',v_target_id
          ),
          updated_at = now()
      where id = v_row.id;

    elsif v_match->>'status' = 'ambiguous' then
      insert into public.import_batch_row_issues(
        batch_id,row_id,issue_type,code,field_name,message,details
      )
      select p_batch_id,v_row.id,'duplicate','ambiguous_person_reference','codigo_referencia',
        'El código de referencia coincide con más de una persona autorizada y requiere saneamiento.',
        jsonb_build_object('match_count', v_match->'match_count')
      where not exists (
        select 1 from public.import_batch_row_issues issue
        where issue.row_id = v_row.id
          and issue.status = 'open'
          and issue.code = 'ambiguous_person_reference'
      );

      update public.import_batch_rows
      set target_operation = null,
          target_schema = null,
          target_table = null,
          target_record_id = null,
          resolved_relations = resolved_relations - 'matched_person_id' - 'noop_reason' || jsonb_build_object('match_status','ambiguous'),
          updated_at = now()
      where id = v_row.id;

    elsif v_reference_exists then
      insert into public.import_batch_row_issues(
        batch_id,row_id,issue_type,code,field_name,message,details
      )
      select p_batch_id,v_row.id,'unresolved_relation','person_reference_out_of_country','codigo_referencia',
        'El código de referencia no está disponible dentro del país administrativo del lote.',
        jsonb_build_object('expected_country', v_batch_country)
      where not exists (
        select 1 from public.import_batch_row_issues issue
        where issue.row_id = v_row.id
          and issue.status = 'open'
          and issue.code = 'person_reference_out_of_country'
      );

      update public.import_batch_rows
      set target_operation = null,
          target_schema = null,
          target_table = null,
          target_record_id = null,
          resolved_relations = resolved_relations - 'matched_person_id' - 'noop_reason' || jsonb_build_object('match_status','not_available_in_country'),
          updated_at = now()
      where id = v_row.id;

    else
      update public.import_batch_rows
      set resolved_relations = resolved_relations - 'matched_person_id' - 'noop_reason' || jsonb_build_object('match_status','not_found'),
          updated_at = now()
      where id = v_row.id;
    end if;
  end loop;

  return app_private.refresh_import_batch_validation_summary(p_batch_id)
    || jsonb_build_object(
      'noop_rows',(select count(*) from public.import_batch_rows where batch_id=p_batch_id and target_operation='noop'),
      'match_contract','not_found|exact|ambiguous|not_available_in_country',
      'person_noop_key','person_private_validation.internal_reference_code'
    );
end;
$$;

create or replace function app_private.validate_import_batch_with_contract(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'app_private', 'auth', 'pg_temp'
as $$
declare
  v_actor uuid := auth.uid();
  v_summary jsonb;
  v_import_type text;
  v_status text;
  v_scope_entity_id uuid;
begin
  if v_actor is null
     or not app_private.current_user_has_permission('imports.prepare') then
    raise exception 'No autorizado para validar importaciones.' using errcode = '42501';
  end if;

  select import_type, status, scope_entity_id
  into v_import_type, v_status, v_scope_entity_id
  from public.import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode = 'P0002';
  end if;

  if v_scope_entity_id is null
     or not app_private.current_user_can_manage_entity('imports.prepare', v_scope_entity_id) then
    raise exception 'El lote está fuera de tu alcance de validación.' using errcode = '42501';
  end if;

  if v_status in ('applying','applied','cancelled') then
    raise exception 'El lote ya no admite revalidación.' using errcode = '22023';
  end if;

  v_summary := app_private.validate_import_batch(p_batch_id);

  if v_import_type = 'personas' then
    perform app_private.finalize_person_import_validation(p_batch_id);
    return app_private.promote_person_reference_matches_to_noop(p_batch_id);
  elsif v_import_type = 'parroquias' then
    perform app_private.finalize_structure_import_validation(p_batch_id);
    perform app_private.promote_exact_structure_matches_to_noop(p_batch_id);
    return app_private.enforce_structure_import_country_consistency(p_batch_id);
  elsif v_import_type = 'asignaciones' then
    perform app_private.finalize_assignment_import_validation(p_batch_id);
    return app_private.promote_exact_import_matches_to_noop(p_batch_id);
  elsif v_import_type = 'eventos' then
    perform app_private.finalize_event_import_validation(p_batch_id);
    perform app_private.promote_exact_import_matches_to_noop(p_batch_id);
    return app_private.classify_event_import_updates(p_batch_id);
  end if;

  return v_summary;
end;
$$;

revoke all on function app_private.refresh_import_batch_validation_summary(uuid) from public, anon, authenticated;
revoke all on function app_private.enforce_structure_import_country_consistency(uuid) from public, anon, authenticated;
revoke all on function app_private.promote_person_reference_matches_to_noop(uuid) from public, anon, authenticated;
revoke all on function app_private.validate_import_batch_with_contract(uuid) from public, anon, authenticated;