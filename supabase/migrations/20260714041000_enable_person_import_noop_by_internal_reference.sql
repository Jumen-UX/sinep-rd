begin;

create or replace function app_private.promote_person_reference_matches_to_noop(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,app_private,auth,pg_temp
as $$
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
  if v_batch.import_type<>'personas' then return v_batch.validation_summary; end if;

  for v_row in select * from public.import_batch_rows where batch_id=p_batch_id order by row_number loop
    v_target_id:=null;
    v_match_count:=0;
    if nullif(btrim(v_row.normalized_data->>'codigo_referencia'),'') is not null then
      select count(*),(array_agg(p.id order by p.id))[1]
      into v_match_count,v_target_id
      from public.persons p
      where lower(btrim(coalesce(p.internal_reference_code,'')))=lower(btrim(v_row.normalized_data->>'codigo_referencia'));

      if v_match_count=1 and v_target_id is not null then
        update public.import_batch_row_issues
        set status='resolved',resolved_by=auth.uid(),resolved_at=now(),resolution_notes='Coincidencia exacta por código interno estable enlazada como noop.'
        where row_id=v_row.id and status='open' and issue_type in ('duplicate','warning');

        update public.import_batch_rows
        set status='valid',target_operation='noop',target_schema='public',target_table='persons',target_record_id=v_target_id,
            resolved_relations=resolved_relations||jsonb_build_object('noop_reason','exact_internal_reference_match','matched_person_id',v_target_id),updated_at=now()
        where id=v_row.id;
      elsif v_match_count>1 then
        insert into public.import_batch_row_issues(batch_id,row_id,issue_type,code,field_name,message,details)
        select p_batch_id,v_row.id,'duplicate','ambiguous_person_reference','codigo_referencia','El código de referencia coincide con más de una persona y requiere saneamiento.',jsonb_build_object('match_count',v_match_count)
        where not exists(select 1 from public.import_batch_row_issues i where i.row_id=v_row.id and i.status='open' and i.code='ambiguous_person_reference');
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
  v_summary:=coalesce(v_batch.validation_summary,'{}'::jsonb)||jsonb_build_object('batch_id',p_batch_id,'status',v_status,'valid_rows',v_valid,'warning_rows',v_warning,'error_rows',v_error,'duplicate_rows',v_duplicate,'unresolved_rows',v_unresolved,'noop_rows',(select count(*) from public.import_batch_rows where batch_id=p_batch_id and target_operation='noop'),'person_noop_key','internal_reference_code');
  update public.import_batches set status=v_status,valid_rows=v_valid,warning_rows=v_warning,error_rows=v_error,duplicate_rows=v_duplicate,unresolved_rows=v_unresolved,validation_summary=v_summary,updated_at=now() where id=p_batch_id;
  return v_summary;
end;
$$;

revoke all on function app_private.promote_person_reference_matches_to_noop(uuid) from public,anon,authenticated;
grant execute on function app_private.promote_person_reference_matches_to_noop(uuid) to service_role;

create or replace function app_private.validate_import_batch_with_contract(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,app_private,auth,pg_temp
as $$
declare
  v_summary jsonb;
  v_import_type text;
  v_status text;
begin
  select import_type,status into v_import_type,v_status from public.import_batches where id=p_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_status in ('applying','applied','cancelled') then raise exception 'El lote ya no admite revalidación.' using errcode='22023'; end if;

  v_summary:=app_private.validate_import_batch(p_batch_id);
  if v_import_type='personas' then
    perform app_private.finalize_person_import_validation(p_batch_id);
    return app_private.promote_person_reference_matches_to_noop(p_batch_id);
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
$$;

revoke all on function app_private.validate_import_batch_with_contract(uuid) from public,anon,authenticated;
grant execute on function app_private.validate_import_batch_with_contract(uuid) to service_role;

commit;
