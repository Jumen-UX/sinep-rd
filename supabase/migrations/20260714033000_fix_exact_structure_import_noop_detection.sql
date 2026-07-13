create or replace function app_private.promote_exact_structure_matches_to_noop(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','app_private','internal','auth','pg_temp'
as $function$
declare
  v_batch public.import_batches%rowtype;
  v_row public.import_batch_rows%rowtype;
  v_target_id uuid;
  v_match_count integer;
begin
  select * into v_batch
  from public.import_batches
  where id=p_batch_id
  for update;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode='P0002';
  end if;
  if v_batch.import_type<>'parroquias' then
    return v_batch.validation_summary;
  end if;

  for v_row in
    select * from public.import_batch_rows
    where batch_id=p_batch_id
    order by row_number
  loop
    select count(*), (array_agg(sn.linked_ecclesiastical_entity_id order by sn.id))[1]
    into v_match_count,v_target_id
    from public.structure_nodes sn
    join public.ecclesiastical_entities ee
      on ee.id=sn.linked_ecclesiastical_entity_id
    where sn.template_id=nullif(v_row.resolved_relations->>'template_id','')::uuid
      and sn.parent_node_id=nullif(v_row.resolved_relations->>'parent_node_id','')::uuid
      and sn.level_id=nullif(v_row.resolved_relations->>'level_id','')::uuid
      and sn.is_current=true
      and sn.status in ('active','draft')
      and sn.linked_ecclesiastical_entity_id is not null
      and (
        lower(btrim(ee.name))=lower(btrim(v_row.normalized_data->>'nombre'))
        or lower(btrim(coalesce(ee.official_name,'')))=lower(btrim(v_row.normalized_data->>'nombre'))
      );

    if v_match_count=1 and v_target_id is not null then
      update public.import_batch_row_issues
      set status='resolved',resolved_by=auth.uid(),resolved_at=now(),
          resolution_notes='Coincidencia estructural exacta enlazada como noop.'
      where row_id=v_row.id
        and status in ('open','superseded')
        and code in ('exact_structure_duplicate','possible_existing_entity');

      update public.import_batch_rows
      set status='valid',
          target_operation='noop',
          target_schema='public',
          target_table='ecclesiastical_entities',
          target_record_id=v_target_id,
          resolved_relations=resolved_relations||jsonb_build_object(
            'noop_reason','exact_contextual_entity_match',
            'matched_entity_id',v_target_id
          ),
          updated_at=now()
      where id=v_row.id;
    end if;
  end loop;

  return app_private.promote_exact_import_matches_to_noop(p_batch_id);
end;
$function$;

revoke all on function app_private.promote_exact_structure_matches_to_noop(uuid) from public,anon,authenticated;
grant execute on function app_private.promote_exact_structure_matches_to_noop(uuid) to service_role;

create or replace function app_private.validate_import_batch_with_contract(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','app_private','auth','pg_temp'
as $function$
declare
  v_summary jsonb;
  v_import_type text;
  v_status text;
begin
  select import_type,status into v_import_type,v_status
  from public.import_batches
  where id=p_batch_id
  for update;

  if not found then
    raise exception 'El lote de importación no existe.' using errcode='P0002';
  end if;
  if v_status in ('applying','applied','cancelled') then
    raise exception 'El lote ya no admite revalidación.' using errcode='22023';
  end if;

  v_summary:=app_private.validate_import_batch(p_batch_id);

  if v_import_type='personas' then
    return app_private.finalize_person_import_validation(p_batch_id);
  end if;
  if v_import_type='parroquias' then
    perform app_private.finalize_structure_import_validation(p_batch_id);
    return app_private.promote_exact_structure_matches_to_noop(p_batch_id);
  end if;
  if v_import_type='asignaciones' then
    perform app_private.finalize_assignment_import_validation(p_batch_id);
    return app_private.promote_exact_import_matches_to_noop(p_batch_id);
  end if;
  if v_import_type='eventos' then
    perform app_private.finalize_event_import_validation(p_batch_id);
    perform app_private.promote_exact_import_matches_to_noop(p_batch_id);
    return app_private.classify_event_import_updates(p_batch_id);
  end if;

  return v_summary;
end;
$function$;

revoke all on function app_private.validate_import_batch_with_contract(uuid) from public,anon,authenticated;
grant execute on function app_private.validate_import_batch_with_contract(uuid) to service_role;
