create or replace function app_private.canonical_event_scope_entity_id(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path to public,pg_temp
as $$
  select coalesce(
    ce.authority_entity_id,
    (
      select cep.entity_id
      from public.canonical_event_participants cep
      where cep.event_id=ce.id and cep.entity_id is not null
      order by case when cep.role in ('authority','ordinary','affected_jurisdiction','mother_jurisdiction') then 0 else 1 end,cep.created_at
      limit 1
    ),
    (
      select ou.ecclesiastical_entity_id
      from public.canonical_event_participants cep
      join public.organization_units ou on ou.id=cep.organization_unit_id
      where cep.event_id=ce.id and cep.organization_unit_id is not null
      order by case when cep.role in ('affected_unit','created_unit') then 0 else 1 end,cep.created_at
      limit 1
    )
  )
  from public.canonical_events ce
  where ce.id=p_event_id;
$$;

create or replace function internal.admin_create_event_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to public,internal
as $$
declare
  v_event_id uuid;
  v_event_type record;
  v_entity_id uuid;
  v_unit_id uuid;
  v_scope_entity_id uuid;
  v_role text;
  v_title text;
  v_event_date date;
  v_effective_date date;
  v_load_mode text;
  v_evidence_status text;
  v_target_kind text;
begin
  if not internal.current_user_has_admin_role() then raise exception 'not_authorized'; end if;
  v_title:=nullif(trim(payload->>'title'),'');
  if v_title is null then raise exception 'title_required'; end if;

  select id,key,applies_to into v_event_type
  from public.canonical_event_types
  where key=payload->>'event_type_key' and is_active=true;
  if not found then raise exception 'invalid_event_type'; end if;

  v_target_kind:=coalesce(nullif(payload->>'target_kind',''),case when v_event_type.applies_to='organization_unit' then 'organization_unit' else 'entity' end);
  if v_target_kind not in ('entity','organization_unit') then raise exception 'invalid_target_kind'; end if;

  if v_target_kind='organization_unit' then
    if v_event_type.applies_to<>'organization_unit' then raise exception 'event_type_target_mismatch'; end if;
    if nullif(payload->>'organization_unit_id','') is not null then
      v_unit_id:=(payload->>'organization_unit_id')::uuid;
      select ecclesiastical_entity_id into v_scope_entity_id from public.organization_units where id=v_unit_id;
      if v_scope_entity_id is null then raise exception 'invalid_organization_unit'; end if;
    else
      if v_event_type.key<>'organization_unit_creation' then raise exception 'organization_unit_required'; end if;
      v_scope_entity_id:=nullif(payload->>'scope_entity_id','')::uuid;
      if v_scope_entity_id is null or not exists(select 1 from public.ecclesiastical_entities where id=v_scope_entity_id and status='active') then raise exception 'invalid_scope_entity'; end if;
    end if;
    v_role:=coalesce(nullif(payload->>'organization_unit_role',''),case when v_event_type.key='organization_unit_creation' then 'created_unit' else 'affected_unit' end);
    if v_role not in ('created_unit','affected_unit','source_unit','target_unit','parent_before','parent_after') then raise exception 'invalid_organization_unit_role'; end if;
  else
    if v_event_type.applies_to='organization_unit' then raise exception 'event_type_target_mismatch'; end if;
    if nullif(payload->>'entity_id','') is not null then
      v_entity_id:=(payload->>'entity_id')::uuid;
      if not exists(select 1 from public.ecclesiastical_entities where id=v_entity_id and status='active') then raise exception 'invalid_entity'; end if;
      v_scope_entity_id:=v_entity_id;
    end if;
    v_role:=coalesce(nullif(payload->>'entity_role',''),'affected_jurisdiction');
    if v_role not in ('created_entity','suppressed_entity','origin_entity','destination_entity','mother_jurisdiction','new_jurisdiction','metropolitan_see','suffragan_jurisdiction','affected_jurisdiction','authority','ordinary','source_entity','target_entity') then raise exception 'invalid_entity_role'; end if;
  end if;

  v_load_mode:=coalesce(nullif(payload->>'load_mode',''),'evento_nuevo');
  if v_load_mode not in ('carga_historica','evento_nuevo','foto_inicial') then raise exception 'invalid_load_mode'; end if;
  v_evidence_status:=coalesce(nullif(payload->>'evidence_status',''),'pendiente_documento');
  if v_evidence_status not in ('confirmado_oficial','fuente_secundaria','importado_vigente','pendiente_documento','contradictorio','corregido','documentado','verified') then raise exception 'invalid_evidence_status'; end if;
  if nullif(payload->>'event_date','') is not null then v_event_date:=(payload->>'event_date')::date; end if;
  if nullif(payload->>'effective_date','') is not null then v_effective_date:=(payload->>'effective_date')::date; end if;
  if v_load_mode<>'foto_inicial' and v_event_date is null then raise exception 'event_date_required'; end if;

  insert into public.canonical_events(event_type_id,title,description,event_date,effective_date,authority_entity_id,status,created_by,load_mode,evidence_status,source_name_text,source_url_text,notes_json)
  values(v_event_type.id,v_title,nullif(payload->>'description',''),v_event_date,v_effective_date,v_scope_entity_id,'pending_review',auth.uid(),v_load_mode,v_evidence_status,nullif(payload->>'source_name',''),nullif(payload->>'source_url',''),jsonb_build_object('notes',nullif(payload->>'notes',''),'created_from','admin_event_assistant','target_kind',v_target_kind,'raw_payload',payload))
  returning id into v_event_id;

  if v_entity_id is not null then
    insert into public.canonical_event_participants(event_id,entity_id,role,before_state,after_state)
    values(v_event_id,v_entity_id,v_role,null,jsonb_build_object('mode',v_load_mode,'evidence_status',v_evidence_status));
  elsif v_unit_id is not null then
    insert into public.canonical_event_participants(event_id,organization_unit_id,role,before_state,after_state)
    select v_event_id,ou.id,v_role,to_jsonb(ou),jsonb_build_object('mode',v_load_mode,'evidence_status',v_evidence_status)
    from public.organization_units ou where ou.id=v_unit_id;
  end if;
  return v_event_id;
end;
$$;

create or replace function app_private.rpc_definer__admin_create_event_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to public,internal,app_private,auth,pg_temp
as $$
declare
  v_entity_id uuid:=app_private.audit_json_uuid(payload,'entity_id');
  v_unit_id uuid:=app_private.audit_json_uuid(payload,'organization_unit_id');
  v_scope_entity_id uuid:=app_private.audit_json_uuid(payload,'scope_entity_id');
  v_event_id uuid;
  v_new jsonb;
begin
  if not public.current_user_has_permission('events.create_proposal') and not public.current_user_is_super_or_national() then raise exception 'No autorizado para crear eventos' using errcode='42501'; end if;
  if v_unit_id is not null then
    select ecclesiastical_entity_id into v_scope_entity_id from public.organization_units where id=v_unit_id;
  elsif v_scope_entity_id is null then
    v_scope_entity_id:=v_entity_id;
  end if;
  if v_scope_entity_id is null and not public.current_user_is_super_or_national() then raise exception 'El evento debe indicar un ámbito administrable' using errcode='42501'; end if;
  if v_scope_entity_id is not null and not app_private.current_user_can_manage_entity('events.create_proposal',v_scope_entity_id) then raise exception 'El evento está fuera de tu alcance' using errcode='42501'; end if;
  v_event_id:=internal.admin_create_event_draft(payload);
  select to_jsonb(ce) into v_new from public.canonical_events ce where ce.id=v_event_id;
  perform public.create_audit_log(auth.uid(),'events.draft.created','canonical_events',v_event_id,null,jsonb_build_object('scope_entity_id',v_scope_entity_id,'organization_unit_id',v_unit_id,'record',v_new),app_private.audit_json_uuid(payload,'change_request_id'));
  return v_event_id;
end;
$$;

create or replace function internal.admin_generate_organization_unit_event_action_plan(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to public,internal
as $$
declare
  v_event_id uuid:=nullif(payload->>'event_id','')::uuid;
  v_event record;
  v_raw jsonb;
  v_unit_id uuid;
  v_parent_id uuid;
  v_has_source boolean;
  v_sort integer:=10;
  v_count integer:=0;
  v_action_key text;
  v_action_payload jsonb;
begin
  if not internal.current_user_has_admin_role() then raise exception 'not_authorized'; end if;
  select ce.*,cet.key event_type_key,cet.applies_to into v_event
  from public.canonical_events ce join public.canonical_event_types cet on cet.id=ce.event_type_id
  where ce.id=v_event_id for update;
  if not found then raise exception 'event_not_found'; end if;
  if v_event.applies_to<>'organization_unit' then raise exception 'event_is_not_organizational'; end if;
  if v_event.status in ('applied','cancelled') then raise exception 'event_plan_locked'; end if;

  v_raw:=coalesce(v_event.notes_json->'raw_payload','{}'::jsonb);
  select organization_unit_id into v_unit_id
  from public.canonical_event_participants
  where event_id=v_event_id and organization_unit_id is not null
  order by created_at limit 1;
  v_parent_id:=coalesce(nullif(v_raw->>'new_parent_unit_id','')::uuid,nullif(v_raw->>'parent_unit_id','')::uuid);
  v_has_source:=coalesce(v_event.source_name_text,v_event.source_url_text,v_event.source_document_id::text) is not null;

  delete from public.canonical_event_actions where event_id=v_event_id and status<>'applied';
  insert into public.canonical_event_actions(event_id,action_type_key,payload,sort_order,status,created_by,notes)
  values(v_event_id,'validate_event',jsonb_build_object('has_title',v_event.title is not null and length(trim(v_event.title))>0,'has_event_type',v_event.event_type_key is not null,'has_date',v_event.event_date is not null,'has_scope_entity',v_event.authority_entity_id is not null,'target_kind','organization_unit'),v_sort,'ready',auth.uid(),'Validación mínima del evento organizativo.');
  v_count:=v_count+1; v_sort:=v_sort+10;

  insert into public.canonical_event_actions(event_id,action_type_key,payload,sort_order,status,created_by,notes)
  values(v_event_id,case when v_has_source then 'attach_source_reference' else 'manual_relationship_review' end,jsonb_build_object('source_name',v_event.source_name_text,'source_url',v_event.source_url_text,'evidence_status',v_event.evidence_status,'required',true),v_sort,case when v_has_source then 'ready' else 'planned' end,auth.uid(),case when v_has_source then 'Fuente registrada para revisión.' else 'Falta una fuente documental.' end);
  v_count:=v_count+1; v_sort:=v_sort+10;

  if v_event.event_type_key='organization_unit_creation' then
    if nullif(v_raw->>'organization_chart_id','') is null or nullif(v_raw->>'name','') is null then raise exception 'organization_unit_creation_data_required'; end if;
    v_action_key:='create_organization_unit';
    v_action_payload:=jsonb_build_object('organization_chart_id',v_raw->>'organization_chart_id','parent_unit_id',v_raw->>'parent_unit_id','ecclesiastical_entity_id',v_event.authority_entity_id,'pastoral_area_id',v_raw->>'pastoral_area_id','key',v_raw->>'key','name',v_raw->>'name','description',v_raw->>'description','sort_order',coalesce(v_raw->>'sort_order','0'),'visibility',coalesce(v_raw->>'visibility','internal'),'status',coalesce(v_raw->>'status','draft'),'valid_from',v_raw->>'valid_from','valid_to',v_raw->>'valid_to','is_current',coalesce(v_raw->>'is_current','true'));
  elsif v_event.event_type_key='organization_unit_reparenting' then
    if v_unit_id is null then raise exception 'organization_unit_required'; end if;
    v_action_key:='move_organization_unit';
    v_action_payload:=jsonb_build_object('organization_unit_id',v_unit_id,'new_parent_unit_id',v_parent_id);
  elsif v_event.event_type_key='organization_unit_status_change' then
    if v_unit_id is null or coalesce(v_raw->>'new_status','') not in ('active','inactive','archived','draft') then raise exception 'valid_organization_unit_status_required'; end if;
    v_action_key:='update_organization_unit_status';
    v_action_payload:=jsonb_build_object('organization_unit_id',v_unit_id,'new_status',v_raw->>'new_status','is_current',v_raw->>'is_current');
  elsif v_event.event_type_key='organization_unit_publication' then
    if v_unit_id is null then raise exception 'organization_unit_required'; end if;
    v_action_key:='publish_organization_unit';
    v_action_payload:=jsonb_build_object('organization_unit_id',v_unit_id,'new_visibility',coalesce(v_raw->>'new_visibility','public'),'new_status',coalesce(v_raw->>'new_status','active'));
  elsif v_event.event_type_key='organization_unit_validity_change' then
    if v_unit_id is null then raise exception 'organization_unit_required'; end if;
    v_action_key:='update_organization_unit_validity';
    v_action_payload:=jsonb_build_object('organization_unit_id',v_unit_id,'valid_from',v_raw->>'valid_from','valid_to',v_raw->>'valid_to');
  else
    raise exception 'unsupported_organization_event_type';
  end if;

  insert into public.canonical_event_actions(event_id,action_type_key,subject_organization_unit_id,target_organization_unit_id,payload,sort_order,status,created_by,notes)
  values(v_event_id,v_action_key,v_unit_id,case when v_action_key='move_organization_unit' then v_parent_id else null end,v_action_payload,v_sort,'planned',auth.uid(),'Acción organizativa pendiente de aprobación.');
  v_count:=v_count+1;
  update public.canonical_events set notes_json=coalesce(notes_json,'{}'::jsonb)||jsonb_build_object('last_action_plan_generated_at',now(),'action_plan_count',v_count,'target_kind','organization_unit'),updated_at=now() where id=v_event_id;
  return public.get_event_application_plan(v_event_id);
end;
$$;

do $$
begin
  if to_regprocedure('internal.admin_generate_entity_event_action_plan(jsonb)') is null
     and to_regprocedure('internal.admin_generate_event_action_plan(jsonb)') is not null then
    execute 'alter function internal.admin_generate_event_action_plan(jsonb) rename to admin_generate_entity_event_action_plan';
  end if;
end $$;

create or replace function internal.admin_generate_event_action_plan(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to public,internal
as $$
declare
  v_applies_to text;
  v_event_id uuid:=nullif(payload->>'event_id','')::uuid;
begin
  select cet.applies_to into v_applies_to from public.canonical_events ce join public.canonical_event_types cet on cet.id=ce.event_type_id where ce.id=v_event_id;
  if v_applies_to is null then raise exception 'event_not_found'; end if;
  if v_applies_to='organization_unit' then return internal.admin_generate_organization_unit_event_action_plan(payload); end if;
  return internal.admin_generate_entity_event_action_plan(payload);
end;
$$;