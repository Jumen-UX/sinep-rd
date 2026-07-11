create or replace function app_private.finalize_structure_import_validation(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, auth, pg_temp
as $$
declare
  v_batch public.import_batches%rowtype;
  v_row record;
  v_diocese_id uuid;
  v_parent_entity_id uuid;
  v_template_id uuid;
  v_parent_node_id uuid;
  v_level_id uuid;
  v_type text;
  v_visibility text;
  v_duplicate uuid;
  v_valid integer;
  v_warning integer;
  v_error integer;
  v_duplicate_count integer;
  v_unresolved integer;
  v_status text;
  v_summary jsonb;
begin
  select * into v_batch from public.import_batches where id=p_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_batch.import_type <> 'parroquias' then return v_batch.validation_summary; end if;

  update public.import_batch_row_issues
  set status='superseded',resolved_by=auth.uid(),resolved_at=now(),
      resolution_notes=coalesce(resolution_notes,'Sustituida por validación estructural contextual.')
  where batch_id=p_batch_id and status='open' and code='possible_existing_entity';

  for v_row in select * from public.import_batch_rows where batch_id=p_batch_id order by row_number loop
    v_diocese_id := nullif(v_row.resolved_relations->>'diocesis','')::uuid;
    v_parent_entity_id := nullif(v_row.resolved_relations->>'nivel_padre','')::uuid;
    v_type := lower(nullif(btrim(v_row.normalized_data->>'tipo_entidad'),''));
    v_visibility := coalesce(lower(nullif(btrim(v_row.normalized_data->>'visibilidad'),'')),'public');
    v_template_id := null; v_parent_node_id := null; v_level_id := null; v_duplicate := null;

    if v_visibility not in ('public','internal','private','confidential') then
      insert into public.import_batch_row_issues(batch_id,row_id,issue_type,code,field_name,message)
      values(p_batch_id,v_row.id,'validation_error','invalid_structure_visibility','visibilidad','La visibilidad debe ser public, internal, private o confidential.');
    end if;

    if v_diocese_id is not null then
      select id into v_template_id from public.structure_templates
      where diocese_id=v_diocese_id and is_active=true and status='active'
      order by is_primary desc,created_at limit 1;
      if v_template_id is null then
        insert into public.import_batch_row_issues(batch_id,row_id,issue_type,code,field_name,message)
        values(p_batch_id,v_row.id,'unresolved_relation','active_structure_template_not_found','diocesis','La diócesis no tiene una plantilla estructural activa.');
      end if;
    end if;

    if v_template_id is not null and v_parent_entity_id is not null then
      select id into v_parent_node_id from public.structure_nodes
      where template_id=v_template_id and linked_ecclesiastical_entity_id=v_parent_entity_id
        and is_current=true and status='active' order by created_at limit 1;
      if v_parent_node_id is null then
        insert into public.import_batch_row_issues(batch_id,row_id,issue_type,code,field_name,message)
        values(p_batch_id,v_row.id,'unresolved_relation','parent_structure_node_not_found','nivel_padre','La entidad superior no tiene un nodo activo en la plantilla seleccionada.');
      end if;
    end if;

    if v_template_id is not null and v_type is not null then
      select sl.id into v_level_id
      from public.structure_levels sl join public.entity_types et on et.id=sl.linked_entity_type_id
      where sl.template_id=v_template_id and lower(et.key)=v_type and sl.allows_new_nodes=true
      order by sl.level_order limit 1;
      if v_level_id is null then
        insert into public.import_batch_row_issues(batch_id,row_id,issue_type,code,field_name,message)
        values(p_batch_id,v_row.id,'validation_error','structure_level_not_allowed','tipo_entidad','El tipo de entidad no corresponde a un nivel habilitado en esta plantilla.');
      end if;
    end if;

    if v_parent_node_id is not null and v_level_id is not null and not exists(
      select 1 from public.structure_level_edges e join public.structure_nodes p on p.id=v_parent_node_id
      where e.template_id=v_template_id and e.parent_level_id=p.level_id and e.child_level_id=v_level_id
    ) then
      insert into public.import_batch_row_issues(batch_id,row_id,issue_type,code,field_name,message)
      values(p_batch_id,v_row.id,'validation_error','invalid_structure_parent_level','nivel_padre','El nivel superior seleccionado no puede contener este tipo de estructura.');
    end if;

    if v_template_id is not null and v_parent_node_id is not null and v_level_id is not null then
      select id into v_duplicate from public.structure_nodes
      where template_id=v_template_id and parent_node_id=v_parent_node_id and level_id=v_level_id
        and is_current=true and status in ('active','draft')
        and slug=public.structure_engine_slugify(v_row.normalized_data->>'nombre') limit 1;
      if v_duplicate is not null then
        insert into public.import_batch_row_issues(batch_id,row_id,issue_type,code,field_name,message,details)
        values(p_batch_id,v_row.id,'duplicate','exact_structure_duplicate','nombre','Ya existe una estructura con el mismo nombre, tipo y nodo superior.',jsonb_build_object('candidate_node_id',v_duplicate));
      else
        update public.import_batch_rows set
          resolved_relations=resolved_relations||jsonb_build_object('template_id',v_template_id,'level_id',v_level_id,'parent_node_id',v_parent_node_id,'parent_entity_id',v_parent_entity_id,'diocese_id',v_diocese_id),
          target_operation='create',target_schema='public',target_table='ecclesiastical_entities',updated_at=now()
        where id=v_row.id;
      end if;
    end if;
  end loop;

  update public.import_batch_rows r set status=case
    when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='validation_error') then 'error'
    when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='duplicate') then 'duplicate'
    when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='unresolved_relation') then 'unresolved'
    when exists(select 1 from public.import_batch_row_issues i where i.row_id=r.id and i.status='open' and i.issue_type='warning') then 'warning'
    else 'valid' end,updated_at=now() where r.batch_id=p_batch_id;

  select count(*) filter(where status='valid'),count(*) filter(where status='warning'),count(*) filter(where status='error'),count(*) filter(where status='duplicate'),count(*) filter(where status='unresolved')
  into v_valid,v_warning,v_error,v_duplicate_count,v_unresolved from public.import_batch_rows where batch_id=p_batch_id;
  v_status:=case when v_error+v_duplicate_count+v_unresolved>0 then 'needs_review' else 'validated' end;
  v_summary:=jsonb_build_object('batch_id',p_batch_id,'status',v_status,'row_count',v_batch.row_count,'valid_rows',v_valid,'warning_rows',v_warning,'error_rows',v_error,'duplicate_rows',v_duplicate_count,'unresolved_rows',v_unresolved,'can_apply',false,'application_rpc_available',true,'application_domain','parroquias');
  update public.import_batches set status=v_status,valid_rows=v_valid,warning_rows=v_warning,error_rows=v_error,duplicate_rows=v_duplicate_count,unresolved_rows=v_unresolved,validation_summary=v_summary,validated_by=auth.uid(),validated_at=now(),updated_at=now() where id=p_batch_id;
  return v_summary;
end;
$$;

create or replace function app_private.validate_import_batch_with_contract(p_batch_id uuid)
returns jsonb language plpgsql security definer
set search_path=public,app_private,auth,pg_temp
as $$
declare v_summary jsonb; v_import_type text; v_status text;
begin
  select import_type,status into v_import_type,v_status from public.import_batches where id=p_batch_id for update;
  if not found then raise exception 'El lote de importación no existe.' using errcode='P0002'; end if;
  if v_status in ('applying','applied','cancelled') then raise exception 'El lote ya no admite revalidación.' using errcode='22023'; end if;
  v_summary:=app_private.validate_import_batch(p_batch_id);
  if v_import_type='personas' then return app_private.finalize_person_import_validation(p_batch_id); end if;
  if v_import_type='parroquias' then return app_private.finalize_structure_import_validation(p_batch_id); end if;
  return v_summary;
end;
$$;

revoke all on function app_private.finalize_structure_import_validation(uuid) from public,anon,authenticated;
