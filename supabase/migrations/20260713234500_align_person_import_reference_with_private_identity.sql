begin;

-- The canonical internal person code is private validation data. Import matching
-- must resolve against that contract instead of the legacy mirror on persons.
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
      select count(*),(array_agg(ppv.person_id order by ppv.person_id))[1]
      into v_match_count,v_target_id
      from public.person_private_validation ppv
      where lower(btrim(ppv.internal_reference_code))=lower(btrim(v_row.normalized_data->>'codigo_referencia'));

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
  v_summary:=coalesce(v_batch.validation_summary,'{}'::jsonb)||jsonb_build_object('batch_id',p_batch_id,'status',v_status,'valid_rows',v_valid,'warning_rows',v_warning,'error_rows',v_error,'duplicate_rows',v_duplicate,'unresolved_rows',v_unresolved,'noop_rows',(select count(*) from public.import_batch_rows where batch_id=p_batch_id and target_operation='noop'),'person_noop_key','person_private_validation.internal_reference_code');
  update public.import_batches set status=v_status,valid_rows=v_valid,warning_rows=v_warning,error_rows=v_error,duplicate_rows=v_duplicate,unresolved_rows=v_unresolved,validation_summary=v_summary,updated_at=now() where id=p_batch_id;
  return v_summary;
end;
$$;

revoke all on function app_private.promote_person_reference_matches_to_noop(uuid) from public,anon,authenticated;
grant execute on function app_private.promote_person_reference_matches_to_noop(uuid) to service_role;

-- Historical rows predate the unified registration engine. Give every person a
-- canonical private reference without deriving identity from names or documents.
insert into public.person_private_validation(person_id,internal_reference_code,created_by,biography_notes)
select
  p.id,
  public.generate_person_internal_code_for_type(
    case pes.effective_person_type
      when 'bishop' then 'bishop'
      when 'priest' then 'priest'
      when 'deacon' then 'deacon'
      when 'religious' then 'religious'
      else 'layperson'
    end
  ),
  p.created_by,
  'Código interno estable asignado por saneamiento canónico para importación idempotente.'
from public.persons p
left join public.person_ecclesial_state pes on pes.id=p.id
left join public.person_private_validation ppv on ppv.person_id=p.id
where ppv.person_id is null;

commit;
