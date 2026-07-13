create or replace function public.get_event_review(p_event_id uuid)
returns jsonb
language sql
stable
set search_path to public
as $$
  select jsonb_build_object(
    'event',jsonb_build_object(
      'id',ce.id,'title',ce.title,'description',ce.description,'event_date',ce.event_date,
      'effective_date',ce.effective_date,'status',ce.status,'load_mode',ce.load_mode,
      'evidence_status',ce.evidence_status,'source_name',ce.source_name_text,'source_url',ce.source_url_text,
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
      'has_participant',exists(select 1 from public.canonical_event_participants p where p.event_id=ce.id)
        or (cet.applies_to='organization_unit' and cet.key='organization_unit_creation' and ce.authority_entity_id is not null),
      'has_source_reference',coalesce(ce.source_name_text,ce.source_url_text,ce.source_document_id::text) is not null,
      'has_action_plan',exists(select 1 from public.canonical_event_actions a where a.event_id=ce.id),
      'has_blocking_action',exists(select 1 from public.canonical_event_actions a where a.event_id=ce.id and (a.status='failed' or a.action_type_key='manual_relationship_review')),
      'is_pending_review',ce.status='pending_review',
      'can_approve',ce.status='pending_review'
        and ce.title is not null
        and (ce.event_date is not null or ce.load_mode='foto_inicial')
        and coalesce(ce.source_name_text,ce.source_url_text,ce.source_document_id::text) is not null
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
$$;

create or replace function public.get_event_application_contract(p_event_id uuid)
returns jsonb
language sql
stable
set search_path to public
as $$
  with event_row as (
    select ce.id,ce.title,ce.status,ce.load_mode,ce.evidence_status,cet.key event_type_key,cet.name event_type_name,cet.applies_to
    from public.canonical_events ce
    join public.canonical_event_types cet on cet.id=ce.event_type_id
    where ce.id=p_event_id
  ),
  conflict_preview as (
    select case
      when (select applies_to from event_row)='organization_unit'
        then jsonb_build_object('error_count',0,'warning_count',0,'conflicts','[]'::jsonb,'not_applicable',true)
      else public.get_event_relationship_conflict_preview(p_event_id)
    end data
  ),
  action_rows as (
    select cea.id,cea.action_type_key,ceat.name action_type_name,cea.status,ceat.changes_state,
      ceat.requires_manual_review,ceat.auto_apply_allowed,ceat.apply_strategy,ceat.implementation_phase,
      ceat.apply_preconditions,cea.subject_entity_id,subject.name subject_entity_name,
      cea.target_entity_id,target.name target_entity_name,
      cea.subject_organization_unit_id,subject_unit.name subject_organization_unit_name,
      cea.target_organization_unit_id,target_unit.name target_organization_unit_name,
      cea.relationship_type_id,crt.name relationship_type_name,cea.sort_order,
      case
        when cea.status='applied' then 'applied'
        when cea.status='failed' then 'blocked_failed_action'
        when cea.status='planned' then 'blocked_not_reviewed'
        when ceat.apply_strategy in ('manual_only','never_apply') then 'manual_only'
        when ceat.auto_apply_allowed=false and ceat.changes_state=true then 'requires_manual_application'
        when ceat.auto_apply_allowed=true and cea.status='ready' then 'eligible_now'
        else 'review_required'
      end contract_status
    from public.canonical_event_actions cea
    join public.canonical_event_action_types ceat on ceat.key=cea.action_type_key
    left join public.ecclesiastical_entities subject on subject.id=cea.subject_entity_id
    left join public.ecclesiastical_entities target on target.id=cea.target_entity_id
    left join public.organization_units subject_unit on subject_unit.id=cea.subject_organization_unit_id
    left join public.organization_units target_unit on target_unit.id=cea.target_organization_unit_id
    left join public.canonical_relationship_types crt on crt.id=cea.relationship_type_id
    where cea.event_id=p_event_id
  ),
  summary as (
    select jsonb_build_object(
      'event_exists',exists(select 1 from event_row),
      'event_status',(select status from event_row),
      'applies_to',(select applies_to from event_row),
      'action_count',(select count(*) from action_rows),
      'ready_count',(select count(*) from action_rows where status='ready'),
      'planned_count',(select count(*) from action_rows where status='planned'),
      'applied_count',(select count(*) from action_rows where status='applied'),
      'failed_count',(select count(*) from action_rows where status='failed'),
      'state_changing_count',(select count(*) from action_rows where changes_state),
      'manual_only_count',(select count(*) from action_rows where apply_strategy in ('manual_only','never_apply')),
      'relationship_error_count',coalesce(((select data from conflict_preview)->>'error_count')::int,0),
      'relationship_warning_count',coalesce(((select data from conflict_preview)->>'warning_count')::int,0),
      'can_apply',(select status from event_row)='approved'
        and (select applies_to from event_row)='organization_unit'
        and not exists(select 1 from action_rows where status in ('planned','failed')),
      'apply_lock_reason',case
        when (select applies_to from event_row)<>'organization_unit' then 'entity_application_not_enabled'
        when (select status from event_row)<>'approved' then 'event_not_approved'
        when exists(select 1 from action_rows where status in ('planned','failed')) then 'event_actions_not_ready'
        else null
      end
    ) data
  )
  select jsonb_build_object(
    'event',coalesce((select jsonb_build_object('id',id,'title',title,'status',status,'load_mode',load_mode,'evidence_status',evidence_status,'event_type_key',event_type_key,'event_type_name',event_type_name,'applies_to',applies_to) from event_row),'{}'::jsonb),
    'summary',(select data from summary),
    'relationship_conflicts',(select data from conflict_preview),
    'actions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'action_type_key',action_type_key,'action_type_name',action_type_name,'status',status,
      'changes_state',changes_state,'requires_manual_review',requires_manual_review,'auto_apply_allowed',auto_apply_allowed,
      'apply_strategy',apply_strategy,'implementation_phase',implementation_phase,'apply_preconditions',apply_preconditions,
      'contract_status',contract_status,'subject_entity_name',subject_entity_name,'target_entity_name',target_entity_name,
      'subject_organization_unit_name',subject_organization_unit_name,'target_organization_unit_name',target_organization_unit_name,
      'relationship_type_name',relationship_type_name,'sort_order',sort_order
    ) order by sort_order) from action_rows),'[]'::jsonb)
  );
$$;