create or replace function app_private.classify_import_match_candidates(p_candidate_ids uuid[])
returns jsonb
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  with normalized as (
    select coalesce(array_agg(distinct candidate_id order by candidate_id), '{}'::uuid[]) as ids
    from unnest(coalesce(p_candidate_ids, '{}'::uuid[])) candidate_id
    where candidate_id is not null
  )
  select jsonb_build_object(
    'status', case cardinality(ids)
      when 0 then 'not_found'
      when 1 then 'exact'
      else 'ambiguous'
    end,
    'match_count', cardinality(ids),
    'candidate_ids', to_jsonb(ids),
    'selected_id', case when cardinality(ids) = 1 then to_jsonb(ids[1]) else 'null'::jsonb end
  )
  from normalized
$function$;

create or replace function app_private.import_reference_match(p_relation_kind text, p_value text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_candidates uuid[];
begin
  v_candidates := case lower(nullif(btrim(p_relation_kind), ''))
    when 'entity' then app_private.import_entity_matches(p_value)
    when 'person' then app_private.import_person_matches(p_value)
    when 'office' then app_private.import_office_matches(p_value)
    else '{}'::uuid[]
  end;

  return app_private.classify_import_match_candidates(v_candidates)
    || jsonb_build_object(
      'relation_kind', lower(nullif(btrim(p_relation_kind), '')),
      'received', nullif(btrim(p_value), '')
    );
end;
$function$;

create or replace function app_private.classify_import_row_target_match(
  p_import_type text,
  p_normalized_data jsonb,
  p_resolved_relations jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_candidates uuid[] := '{}'::uuid[];
begin
  if p_import_type = 'parroquias' then
    select coalesce(array_agg(sn.linked_ecclesiastical_entity_id order by sn.linked_ecclesiastical_entity_id), '{}'::uuid[])
      into v_candidates
    from public.structure_nodes sn
    where sn.template_id = nullif(p_resolved_relations->>'template_id','')::uuid
      and sn.parent_node_id = nullif(p_resolved_relations->>'parent_node_id','')::uuid
      and sn.level_id = nullif(p_resolved_relations->>'level_id','')::uuid
      and sn.is_current = true
      and sn.status in ('active','draft')
      and sn.slug = public.structure_engine_slugify(p_normalized_data->>'nombre')
      and sn.linked_ecclesiastical_entity_id is not null;
  elsif p_import_type = 'asignaciones' then
    select coalesce(array_agg(pa.id order by pa.id), '{}'::uuid[])
      into v_candidates
    from public.position_assignments pa
    where pa.person_id = nullif(p_resolved_relations->>'persona','')::uuid
      and pa.office_configuration_id = nullif(p_resolved_relations->>'cargo','')::uuid
      and pa.ecclesiastical_entity_id = nullif(p_resolved_relations->>'entidad','')::uuid
      and pa.record_status = 'active'
      and pa.is_current = coalesce((p_resolved_relations->>'is_current')::boolean, true)
      and pa.start_date is not distinct from nullif(p_normalized_data->>'fecha_inicio','')::date;
  elsif p_import_type = 'eventos' then
    select coalesce(array_agg(distinct ce.id order by ce.id), '{}'::uuid[])
      into v_candidates
    from public.canonical_events ce
    join public.canonical_event_participants cep on cep.event_id = ce.id
    where cep.entity_id = nullif(p_resolved_relations->>'entidad','')::uuid
      and ce.event_type_id = nullif(p_resolved_relations->>'canonical_event_type_id','')::uuid
      and coalesce(ce.effective_date, ce.event_date) = nullif(p_normalized_data->>'fecha_efectiva','')::date
      and ce.status <> 'cancelled';
  end if;

  return app_private.classify_import_match_candidates(v_candidates)
    || jsonb_build_object('import_type', p_import_type);
end;
$function$;

create or replace function app_private.promote_exact_import_matches_to_noop(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','app_private','internal','auth','pg_temp'
as $function$
declare
  v_batch public.import_batches%rowtype;
  v_row public.import_batch_rows%rowtype;
  v_match jsonb;
  v_target_id uuid;
  v_valid integer; v_warning integer; v_error integer; v_duplicate integer; v_unresolved integer;
  v_status text; v_summary jsonb;
begin
  select * into v_batch from public.import_batches where id = p_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_batch.import_type not in ('parroquias','asignaciones','eventos') then return v_batch.validation_summary; end if;

  for v_row in
    select * from public.import_batch_rows where batch_id = p_batch_id order by row_number
  loop
    v_match := app_private.classify_import_row_target_match(
      v_batch.import_type,
      v_row.normalized_data,
      v_row.resolved_relations
    );

    if v_match->>'status' = 'exact' then
      v_target_id := nullif(v_match->>'selected_id','')::uuid;

      update public.import_batch_row_issues
      set status='resolved', resolved_by=auth.uid(), resolved_at=now(),
          resolution_notes='Coincidencia exacta única enlazada como noop.'
      where row_id=v_row.id and status='open'
        and code in ('exact_structure_duplicate','possible_existing_entity','existing_assignment','existing_canonical_event');

      update public.import_batch_rows
      set status='valid', target_operation='noop', target_schema='public',
          target_table=case v_batch.import_type
            when 'parroquias' then 'ecclesiastical_entities'
            when 'asignaciones' then 'position_assignments'
            else 'canonical_events'
          end,
          target_record_id=v_target_id,
          resolved_relations=resolved_relations || jsonb_build_object(
            'match_status','exact',
            'noop_reason','exact_unique_match',
            'matched_record_id',v_target_id
          ),
          updated_at=now()
      where id=v_row.id;
    elsif v_match->>'status' = 'ambiguous' then
      insert into public.import_batch_row_issues(
        batch_id,row_id,issue_type,code,field_name,message,details
      )
      select p_batch_id,v_row.id,'duplicate','ambiguous_exact_target_match',null,
        'La fila coincide con varios registros canónicos y requiere selección manual.',v_match
      where not exists (
        select 1 from public.import_batch_row_issues issue
        where issue.row_id=v_row.id and issue.status='open' and issue.code='ambiguous_exact_target_match'
      );

      update public.import_batch_rows
      set target_operation=null,target_schema=null,target_table=null,target_record_id=null,
          resolved_relations=resolved_relations || jsonb_build_object('match_status','ambiguous'),
          updated_at=now()
      where id=v_row.id;
    else
      update public.import_batch_rows
      set resolved_relations=resolved_relations || jsonb_build_object('match_status','not_found'),
          updated_at=now()
      where id=v_row.id;
    end if;
  end loop;

  update public.import_batch_rows row_data
  set status = case
    when row_data.target_operation='noop' and row_data.target_record_id is not null then 'valid'
    else app_private.import_row_status_from_open_issues(row_data.id)
  end,
  updated_at=now()
  where row_data.batch_id=p_batch_id;

  select count(*) filter(where status='valid'),count(*) filter(where status='warning'),
         count(*) filter(where status='error'),count(*) filter(where status='duplicate'),
         count(*) filter(where status='unresolved')
    into v_valid,v_warning,v_error,v_duplicate,v_unresolved
  from public.import_batch_rows where batch_id=p_batch_id;

  v_status := case when v_error+v_duplicate+v_unresolved>0 then 'needs_review' else 'validated' end;
  v_summary := coalesce(v_batch.validation_summary,'{}'::jsonb) || jsonb_build_object(
    'batch_id',p_batch_id,'status',v_status,'valid_rows',v_valid,'warning_rows',v_warning,
    'error_rows',v_error,'duplicate_rows',v_duplicate,'unresolved_rows',v_unresolved,
    'noop_rows',(select count(*) from public.import_batch_rows where batch_id=p_batch_id and target_operation='noop'),
    'ambiguous_match_rows',(select count(*) from public.import_batch_row_issues where batch_id=p_batch_id and status='open' and code='ambiguous_exact_target_match'),
    'match_contract','not_found|exact|ambiguous','noop_supported',true
  );

  update public.import_batches
  set status=v_status,valid_rows=v_valid,warning_rows=v_warning,error_rows=v_error,
      duplicate_rows=v_duplicate,unresolved_rows=v_unresolved,validation_summary=v_summary,updated_at=now()
  where id=p_batch_id;

  return v_summary;
end;
$function$;

create or replace function app_private.promote_person_reference_matches_to_noop(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_batch public.import_batches%rowtype;
  v_row public.import_batch_rows%rowtype;
  v_candidates uuid[];
  v_match jsonb;
  v_target_id uuid;
  v_valid integer; v_warning integer; v_error integer; v_duplicate integer; v_unresolved integer;
  v_status text; v_summary jsonb;
begin
  select * into v_batch from public.import_batches where id=p_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_batch.import_type<>'personas' then return v_batch.validation_summary; end if;

  for v_row in select * from public.import_batch_rows where batch_id=p_batch_id order by row_number loop
    if nullif(btrim(v_row.normalized_data->>'codigo_referencia'),'') is null then
      continue;
    end if;

    select coalesce(array_agg(ppv.person_id order by ppv.person_id), '{}'::uuid[])
      into v_candidates
    from public.person_private_validation ppv
    where lower(btrim(ppv.internal_reference_code))=lower(btrim(v_row.normalized_data->>'codigo_referencia'));

    v_match := app_private.classify_import_match_candidates(v_candidates);

    if v_match->>'status'='exact' then
      v_target_id := nullif(v_match->>'selected_id','')::uuid;
      update public.import_batch_row_issues
      set status='resolved',resolved_by=auth.uid(),resolved_at=now(),
          resolution_notes='Coincidencia exacta por código interno estable enlazada como noop.'
      where row_id=v_row.id and status='open' and issue_type in ('duplicate','warning');

      update public.import_batch_rows
      set status='valid',target_operation='noop',target_schema='public',target_table='persons',
          target_record_id=v_target_id,
          resolved_relations=resolved_relations||jsonb_build_object(
            'match_status','exact','noop_reason','exact_internal_reference_match','matched_person_id',v_target_id
          ),updated_at=now()
      where id=v_row.id;
    elsif v_match->>'status'='ambiguous' then
      insert into public.import_batch_row_issues(batch_id,row_id,issue_type,code,field_name,message,details)
      select p_batch_id,v_row.id,'duplicate','ambiguous_person_reference','codigo_referencia',
        'El código de referencia coincide con más de una persona y requiere saneamiento.',v_match
      where not exists(
        select 1 from public.import_batch_row_issues issue
        where issue.row_id=v_row.id and issue.status='open' and issue.code='ambiguous_person_reference'
      );
      update public.import_batch_rows
      set target_operation=null,target_schema=null,target_table=null,target_record_id=null,
          resolved_relations=resolved_relations||jsonb_build_object('match_status','ambiguous'),updated_at=now()
      where id=v_row.id;
    else
      update public.import_batch_rows
      set resolved_relations=resolved_relations||jsonb_build_object('match_status','not_found'),updated_at=now()
      where id=v_row.id;
    end if;
  end loop;

  update public.import_batch_rows row_data
  set status=case
    when row_data.target_operation='noop' and row_data.target_record_id is not null then 'valid'
    else app_private.import_row_status_from_open_issues(row_data.id)
  end,updated_at=now()
  where row_data.batch_id=p_batch_id;

  select count(*) filter(where status='valid'),count(*) filter(where status='warning'),
         count(*) filter(where status='error'),count(*) filter(where status='duplicate'),
         count(*) filter(where status='unresolved')
    into v_valid,v_warning,v_error,v_duplicate,v_unresolved
  from public.import_batch_rows where batch_id=p_batch_id;

  v_status:=case when v_error+v_duplicate+v_unresolved>0 then 'needs_review' else 'validated' end;
  v_summary:=coalesce(v_batch.validation_summary,'{}'::jsonb)||jsonb_build_object(
    'batch_id',p_batch_id,'status',v_status,'valid_rows',v_valid,'warning_rows',v_warning,
    'error_rows',v_error,'duplicate_rows',v_duplicate,'unresolved_rows',v_unresolved,
    'noop_rows',(select count(*) from public.import_batch_rows where batch_id=p_batch_id and target_operation='noop'),
    'match_contract','not_found|exact|ambiguous',
    'person_noop_key','person_private_validation.internal_reference_code'
  );

  update public.import_batches
  set status=v_status,valid_rows=v_valid,warning_rows=v_warning,error_rows=v_error,
      duplicate_rows=v_duplicate,unresolved_rows=v_unresolved,validation_summary=v_summary,updated_at=now()
  where id=p_batch_id;

  return v_summary;
end;
$function$;

revoke all on function app_private.classify_import_match_candidates(uuid[]) from public,anon,authenticated;
revoke all on function app_private.import_reference_match(text,text) from public,anon,authenticated;
revoke all on function app_private.classify_import_row_target_match(text,jsonb,jsonb) from public,anon,authenticated;
