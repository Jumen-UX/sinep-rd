-- Validate assignment batches through canonical eligibility and duplicate rules.

create or replace function app_private.finalize_assignment_import_validation(p_batch_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,app_private,internal,auth,pg_temp as $$
declare
  v_batch public.import_batches%rowtype; v_row public.import_batch_rows%rowtype;
  v_person_id uuid; v_office_id uuid; v_entity_id uuid; v_is_current boolean; v_eligibility jsonb;
  v_valid int; v_warning int; v_error int; v_duplicate int; v_unresolved int; v_status text; v_summary jsonb;
begin
  select * into v_batch from public.import_batches where id=p_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_batch.import_type<>'asignaciones' then return v_batch.validation_summary; end if;
  for v_row in select * from public.import_batch_rows where batch_id=p_batch_id order by row_number loop
    v_person_id:=nullif(v_row.resolved_relations->>'persona','')::uuid;
    v_office_id:=nullif(v_row.resolved_relations->>'cargo','')::uuid;
    v_entity_id:=nullif(v_row.resolved_relations->>'entidad','')::uuid;
    v_is_current:=coalesce(lower(btrim(v_row.normalized_data->>'actual')) in ('true','1','si','sí'),true);
    if v_person_id is not null and v_office_id is not null and v_entity_id is not null and v_is_current then
      v_eligibility:=internal.evaluate_position_assignment_eligibility(v_person_id,v_office_id,v_entity_id,null,false);
      if not coalesce((v_eligibility->>'eligible')::boolean,false) then
        insert into public.import_batch_row_issues(batch_id,row_id,issue_type,code,field_name,message,details)
        values(p_batch_id,v_row.id,'validation_error','assignment_ineligible','cargo',coalesce(v_eligibility->>'message','La persona no cumple las condiciones del cargo.'),v_eligibility);
      end if;
    end if;
    if v_person_id is not null and v_office_id is not null and v_entity_id is not null and exists(
      select 1 from public.position_assignments pa where pa.person_id=v_person_id and pa.office_configuration_id=v_office_id
      and pa.ecclesiastical_entity_id=v_entity_id and pa.record_status='active' and pa.is_current=v_is_current
      and pa.start_date is not distinct from nullif(v_row.normalized_data->>'fecha_inicio','')::date
    ) then
      insert into public.import_batch_row_issues(batch_id,row_id,issue_type,code,field_name,message,details)
      values(p_batch_id,v_row.id,'duplicate','existing_assignment','persona','El nombramiento ya existe con el mismo titular, cargo, entidad, vigencia y fecha inicial.',jsonb_build_object('person_id',v_person_id,'office_configuration_id',v_office_id,'entity_id',v_entity_id));
    end if;
    update public.import_batch_rows set target_operation='create',target_schema='public',target_table='position_assignments',resolved_relations=resolved_relations||jsonb_build_object('is_current',v_is_current),updated_at=now() where id=v_row.id;
  end loop;
  update public.import_batch_rows r set status=case
    when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='validation_error') then 'error'
    when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='duplicate') then 'duplicate'
    when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='unresolved_relation') then 'unresolved'
    when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='warning') then 'warning' else 'valid' end,updated_at=now()
  where r.batch_id=p_batch_id;
  select count(*) filter(where status='valid'),count(*) filter(where status='warning'),count(*) filter(where status='error'),count(*) filter(where status='duplicate'),count(*) filter(where status='unresolved')
  into v_valid,v_warning,v_error,v_duplicate,v_unresolved from public.import_batch_rows where batch_id=p_batch_id;
  v_status:=case when v_error+v_duplicate+v_unresolved>0 then 'needs_review' else 'validated' end;
  v_summary:=jsonb_build_object('batch_id',p_batch_id,'status',v_status,'row_count',v_batch.row_count,'valid_rows',v_valid,'warning_rows',v_warning,'error_rows',v_error,'duplicate_rows',v_duplicate,'unresolved_rows',v_unresolved,'can_apply',false,'application_rpc_available',true,'application_domain','asignaciones');
  update public.import_batches set status=v_status,valid_rows=v_valid,warning_rows=v_warning,error_rows=v_error,duplicate_rows=v_duplicate,unresolved_rows=v_unresolved,validation_summary=v_summary,updated_at=now() where id=p_batch_id;
  return v_summary;
end; $$;

revoke all on function app_private.finalize_assignment_import_validation(uuid) from public,anon,authenticated;

create or replace function app_private.validate_import_batch_with_contract(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path=public,app_private,auth,pg_temp as $$
declare v_summary jsonb; v_import_type text; v_status text;
begin
  select import_type,status into v_import_type,v_status from public.import_batches where id=p_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_status in ('applying','applied','cancelled') then raise exception 'El lote ya no admite revalidación.' using errcode='22023'; end if;
  v_summary:=app_private.validate_import_batch(p_batch_id);
  if v_import_type='personas' then return app_private.finalize_person_import_validation(p_batch_id); end if;
  if v_import_type='parroquias' then return app_private.finalize_structure_import_validation(p_batch_id); end if;
  if v_import_type='asignaciones' then return app_private.finalize_assignment_import_validation(p_batch_id); end if;
  return v_summary;
end; $$;