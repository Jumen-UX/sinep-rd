create or replace function app_private.promote_exact_import_matches_to_noop(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'app_private', 'internal', 'auth', 'pg_temp'
as $function$
declare
  v_batch public.import_batches%rowtype;
  v_row public.import_batch_rows%rowtype;
  v_target_id uuid;
  v_match_count integer;
  v_valid integer;
  v_warning integer;
  v_error integer;
  v_duplicate integer;
  v_unresolved integer;
  v_status text;
  v_summary jsonb;
begin
  select * into v_batch from public.import_batches where id=p_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_batch.import_type not in ('parroquias','asignaciones','eventos') then return v_batch.validation_summary; end if;

  for v_row in select * from public.import_batch_rows where batch_id=p_batch_id order by row_number loop
    v_target_id:=null; v_match_count:=0;
    if v_batch.import_type='parroquias' then
      select count(*), (array_agg(sn.linked_ecclesiastical_entity_id order by sn.id))[1]
      into v_match_count,v_target_id
      from public.structure_nodes sn
      where sn.template_id=nullif(v_row.resolved_relations->>'template_id','')::uuid
        and sn.parent_node_id=nullif(v_row.resolved_relations->>'parent_node_id','')::uuid
        and sn.level_id=nullif(v_row.resolved_relations->>'level_id','')::uuid
        and sn.is_current=true and sn.status in ('active','draft')
        and sn.slug=public.structure_engine_slugify(v_row.normalized_data->>'nombre')
        and sn.linked_ecclesiastical_entity_id is not null;
      if v_match_count=1 and v_target_id is not null then
        update public.import_batch_row_issues set status='resolved',resolved_by=auth.uid(),resolved_at=now(),resolution_notes='Coincidencia exacta enlazada como noop.'
        where row_id=v_row.id and status='open' and code in ('exact_structure_duplicate','possible_existing_entity');
        update public.import_batch_rows set status='valid',target_operation='noop',target_schema='public',target_table='ecclesiastical_entities',target_record_id=v_target_id,
          resolved_relations=resolved_relations||jsonb_build_object('noop_reason','exact_contextual_match'),updated_at=now() where id=v_row.id;
      end if;
    elsif v_batch.import_type='asignaciones' then
      select count(*), (array_agg(pa.id order by pa.id))[1]
      into v_match_count,v_target_id
      from public.position_assignments pa
      where pa.person_id=nullif(v_row.resolved_relations->>'persona','')::uuid
        and pa.office_configuration_id=nullif(v_row.resolved_relations->>'cargo','')::uuid
        and pa.ecclesiastical_entity_id=nullif(v_row.resolved_relations->>'entidad','')::uuid
        and pa.record_status='active'
        and pa.is_current=coalesce((v_row.resolved_relations->>'is_current')::boolean,true)
        and pa.start_date is not distinct from nullif(v_row.normalized_data->>'fecha_inicio','')::date;
      if v_match_count=1 and v_target_id is not null then
        update public.import_batch_row_issues set status='resolved',resolved_by=auth.uid(),resolved_at=now(),resolution_notes='Coincidencia exacta enlazada como noop.'
        where row_id=v_row.id and status='open' and code='existing_assignment';
        update public.import_batch_rows set status='valid',target_operation='noop',target_schema='public',target_table='position_assignments',target_record_id=v_target_id,
          resolved_relations=resolved_relations||jsonb_build_object('noop_reason','exact_assignment_match'),updated_at=now() where id=v_row.id;
      end if;
    elsif v_batch.import_type='eventos' then
      select count(*), (array_agg(ce.id order by ce.id))[1]
      into v_match_count,v_target_id
      from public.canonical_events ce
      join public.canonical_event_participants cep on cep.event_id=ce.id
      where cep.entity_id=nullif(v_row.resolved_relations->>'entidad','')::uuid
        and ce.event_type_id=nullif(v_row.resolved_relations->>'canonical_event_type_id','')::uuid
        and coalesce(ce.effective_date,ce.event_date)=nullif(v_row.normalized_data->>'fecha_efectiva','')::date
        and ce.status<>'cancelled';
      if v_match_count=1 and v_target_id is not null then
        update public.import_batch_row_issues set status='resolved',resolved_by=auth.uid(),resolved_at=now(),resolution_notes='Coincidencia exacta enlazada como noop.'
        where row_id=v_row.id and status='open' and code='existing_canonical_event';
        update public.import_batch_rows set status='valid',target_operation='noop',target_schema='public',target_table='canonical_events',target_record_id=v_target_id,
          resolved_relations=resolved_relations||jsonb_build_object('noop_reason','exact_event_match'),updated_at=now() where id=v_row.id;
      end if;
    end if;
  end loop;

  update public.import_batch_rows r set status=case
    when r.target_operation='noop' and r.target_record_id is not null then 'valid'
    when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='validation_error') then 'error'
    when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='duplicate') then 'duplicate'
    when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='unresolved_relation') then 'unresolved'
    when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='warning') then 'warning'
    else 'valid' end,updated_at=now()
  where r.batch_id=p_batch_id;

  select count(*) filter(where status='valid'),count(*) filter(where status='warning'),count(*) filter(where status='error'),count(*) filter(where status='duplicate'),count(*) filter(where status='unresolved')
  into v_valid,v_warning,v_error,v_duplicate,v_unresolved from public.import_batch_rows where batch_id=p_batch_id;
  v_status:=case when v_error+v_duplicate+v_unresolved>0 then 'needs_review' else 'validated' end;
  v_summary:=coalesce(v_batch.validation_summary,'{}'::jsonb)||jsonb_build_object('batch_id',p_batch_id,'status',v_status,'valid_rows',v_valid,'warning_rows',v_warning,
    'error_rows',v_error,'duplicate_rows',v_duplicate,'unresolved_rows',v_unresolved,
    'noop_rows',(select count(*) from public.import_batch_rows where batch_id=p_batch_id and target_operation='noop'),'noop_supported',true);
  update public.import_batches set status=v_status,valid_rows=v_valid,warning_rows=v_warning,error_rows=v_error,duplicate_rows=v_duplicate,unresolved_rows=v_unresolved,
    validation_summary=v_summary,updated_at=now() where id=p_batch_id;
  return v_summary;
end;
$function$;

revoke all on function app_private.promote_exact_import_matches_to_noop(uuid) from public, anon, authenticated;
grant execute on function app_private.promote_exact_import_matches_to_noop(uuid) to service_role;