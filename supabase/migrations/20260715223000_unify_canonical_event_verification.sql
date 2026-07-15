-- S5-04: preserve documentary evidence while adding the shared verification contract.

alter table public.canonical_events
  add column if not exists source_checked_at date,
  add column if not exists verification_status text not null default 'pending_review';

alter table public.canonical_events
  drop constraint if exists canonical_events_verification_status_check;

alter table public.canonical_events
  add constraint canonical_events_verification_status_check
  check (verification_status in ('pending_review','verified','rejected','unverified'));

update public.canonical_events
set verification_status = case
  when evidence_status in ('confirmado_oficial','documentado','verified')
    and source_name_text is not null
    and source_checked_at is not null then 'verified'
  when evidence_status = 'contradictorio' then 'rejected'
  when evidence_status in ('pendiente_documento','importado_vigente') then 'unverified'
  else 'pending_review'
end
where verification_status = 'pending_review';

create or replace function internal.admin_create_event_draft(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public','internal'
as $function$
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
  v_source_checked_at date;
  v_load_mode text;
  v_evidence_status text;
  v_verification_status text;
  v_target_kind text;
  v_source_name text;
  v_source_url text;
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
  v_verification_status:=coalesce(nullif(payload->>'verification_status',''),'pending_review');
  if v_verification_status not in ('pending_review','verified','rejected','unverified') then raise exception 'invalid_verification_status'; end if;
  v_source_name:=nullif(trim(payload->>'source_name'),'');
  v_source_url:=nullif(trim(payload->>'source_url'),'');
  if nullif(payload->>'source_checked_at','') is not null then v_source_checked_at:=(payload->>'source_checked_at')::date; end if;
  if v_verification_status='verified' and (v_source_name is null or v_source_checked_at is null) then raise exception 'verified_source_requires_name_and_date'; end if;
  if nullif(payload->>'event_date','') is not null then v_event_date:=(payload->>'event_date')::date; end if;
  if nullif(payload->>'effective_date','') is not null then v_effective_date:=(payload->>'effective_date')::date; end if;
  if v_load_mode<>'foto_inicial' and v_event_date is null then raise exception 'event_date_required'; end if;

  insert into public.canonical_events(
    event_type_id,title,description,event_date,effective_date,authority_entity_id,status,created_by,
    load_mode,evidence_status,source_name_text,source_url_text,source_checked_at,verification_status,notes_json
  )
  values(
    v_event_type.id,v_title,nullif(payload->>'description',''),v_event_date,coalesce(v_effective_date,v_event_date),
    v_scope_entity_id,'pending_review',auth.uid(),v_load_mode,v_evidence_status,v_source_name,v_source_url,
    v_source_checked_at,v_verification_status,
    jsonb_build_object('notes',nullif(payload->>'notes',''),'created_from','admin_event_assistant','target_kind',v_target_kind,'raw_payload',payload)
  )
  returning id into v_event_id;

  if v_entity_id is not null then
    insert into public.canonical_event_participants(event_id,entity_id,role,before_state,after_state)
    values(v_event_id,v_entity_id,v_role,null,jsonb_build_object('mode',v_load_mode,'evidence_status',v_evidence_status,'verification_status',v_verification_status));
  elsif v_unit_id is not null then
    insert into public.canonical_event_participants(event_id,organization_unit_id,role,before_state,after_state)
    select v_event_id,ou.id,v_role,to_jsonb(ou),jsonb_build_object('mode',v_load_mode,'evidence_status',v_evidence_status,'verification_status',v_verification_status)
    from public.organization_units ou where ou.id=v_unit_id;
  end if;
  return v_event_id;
end;
$function$;

create or replace function public.get_event_review(p_event_id uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'event',jsonb_build_object(
      'id',ce.id,'title',ce.title,'description',ce.description,'event_date',ce.event_date,
      'effective_date',ce.effective_date,'status',ce.status,'load_mode',ce.load_mode,
      'evidence_status',ce.evidence_status,'verification_status',ce.verification_status,
      'source_name',ce.source_name_text,'source_url',ce.source_url_text,'source_checked_at',ce.source_checked_at,
      'notes',ce.notes_json,'created_at',ce.created_at,'approved_at',ce.approved_at,'applied_at',ce.applied_at,
      'event_type_key',cet.key,'event_type_name',cet.name,'applies_to',cet.applies_to,
      'created_by',ce.created_by,'approved_by',ce.approved_by,'applied_by',ce.applied_by
    ),
    'participants',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',cep.id,'role',cep.role,'target_kind',case when cep.organization_unit_id is not null then 'organization_unit' else 'entity' end,
        'entity_id',cep.entity_id,'entity_name',ent.name,'entity_type_key',et.key,'entity_type_name',et.name,
        'organization_unit_id',cep.organization_unit_id,'organization_unit_name',ou.name,
        'organization_chart_id',ou.organization_chart_id,'organization_chart_name',oc.name,
        'scope_entity_id',ou.ecclesiastical_entity_id,'scope_entity_name',scope_entity.name,
        'before_state',cep.before_state,'after_state',cep.after_state,'created_at',cep.created_at
      ) order by cep.created_at)
      from public.canonical_event_participants cep
      left join public.ecclesiastical_entities ent on ent.id=cep.entity_id
      left join public.entity_types et on et.id=ent.entity_type_id
      left join public.organization_units ou on ou.id=cep.organization_unit_id
      left join public.organization_charts oc on oc.id=ou.organization_chart_id
      left join public.ecclesiastical_entities scope_entity on scope_entity.id=ou.ecclesiastical_entity_id
      where cep.event_id=ce.id
    ),'[]'::jsonb),
    'review_checks',jsonb_build_object(
      'has_title',ce.title is not null and length(trim(ce.title))>0,
      'has_event_type',cet.id is not null,
      'has_date_or_initial_snapshot',ce.event_date is not null or ce.load_mode='foto_inicial',
      'has_effective_date',ce.effective_date is not null,
      'has_participant',exists(select 1 from public.canonical_event_participants p where p.event_id=ce.id)
        or (cet.applies_to='organization_unit' and cet.key='organization_unit_creation' and ce.authority_entity_id is not null),
      'has_source_reference',coalesce(ce.source_name_text,ce.source_url_text,ce.source_document_id::text) is not null,
      'has_verification_contract',ce.verification_status<>'verified' or (ce.source_name_text is not null and ce.source_checked_at is not null),
      'has_action_plan',exists(select 1 from public.canonical_event_actions a where a.event_id=ce.id),
      'has_blocking_action',exists(select 1 from public.canonical_event_actions a where a.event_id=ce.id and (a.status='failed' or a.action_type_key='manual_relationship_review')),
      'is_pending_review',ce.status='pending_review',
      'can_approve',ce.status='pending_review'
        and ce.title is not null
        and ce.effective_date is not null
        and (ce.event_date is not null or ce.load_mode='foto_inicial')
        and coalesce(ce.source_name_text,ce.source_url_text,ce.source_document_id::text) is not null
        and (ce.verification_status<>'verified' or (ce.source_name_text is not null and ce.source_checked_at is not null))
        and (
          (cet.applies_to='organization_unit' and exists(select 1 from public.canonical_event_actions a where a.event_id=ce.id)
            and not exists(select 1 from public.canonical_event_actions a where a.event_id=ce.id and (a.status='failed' or a.action_type_key='manual_relationship_review')))
          or
          (cet.applies_to<>'organization_unit' and exists(select 1 from public.canonical_event_participants p where p.event_id=ce.id))
        )
    )
  )
  from public.canonical_events ce
  join public.canonical_event_types cet on cet.id=ce.event_type_id
  where ce.id=p_event_id;
$function$;
