-- S5-05: expose all immutable inputs needed by the deterministic impact builder.
-- This remains a stable, read-only projection. It does not generate, approve or apply actions.

create or replace function public.get_event_application_plan(p_event_id uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'event',jsonb_build_object(
      'id',ce.id,
      'title',ce.title,
      'status',ce.status,
      'load_mode',ce.load_mode,
      'evidence_status',ce.evidence_status,
      'verification_status',ce.verification_status,
      'event_date',ce.event_date,
      'effective_date',ce.effective_date,
      'event_type_key',cet.key,
      'event_type_name',cet.name,
      'applies_to',cet.applies_to
    ),
    'actions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',cea.id,
        'action_type_key',cea.action_type_key,
        'action_type_name',ceat.name,
        'description',ceat.description,
        'changes_state',ceat.changes_state,
        'requires_manual_review',ceat.requires_manual_review,
        'status',cea.status,
        'notes',cea.notes,
        'subject_entity_id',cea.subject_entity_id,
        'subject_entity_name',subject.name,
        'target_entity_id',cea.target_entity_id,
        'target_entity_name',target.name,
        'subject_organization_unit_id',cea.subject_organization_unit_id,
        'subject_organization_unit_name',subject_unit.name,
        'target_organization_unit_id',cea.target_organization_unit_id,
        'target_organization_unit_name',target_unit.name,
        'relationship_type_id',cea.relationship_type_id,
        'relationship_type_name',crt.name,
        'payload',cea.payload,
        'sort_order',cea.sort_order,
        'updated_at',cea.updated_at
      ) order by cea.sort_order,cea.id)
      from public.canonical_event_actions cea
      join public.canonical_event_action_types ceat on ceat.key=cea.action_type_key
      left join public.ecclesiastical_entities subject on subject.id=cea.subject_entity_id
      left join public.ecclesiastical_entities target on target.id=cea.target_entity_id
      left join public.organization_units subject_unit on subject_unit.id=cea.subject_organization_unit_id
      left join public.organization_units target_unit on target_unit.id=cea.target_organization_unit_id
      left join public.canonical_relationship_types crt on crt.id=cea.relationship_type_id
      where cea.event_id=ce.id
    ),'[]'::jsonb),
    'summary',jsonb_build_object(
      'action_count',(select count(*) from public.canonical_event_actions a where a.event_id=ce.id),
      'ready_count',(select count(*) from public.canonical_event_actions a where a.event_id=ce.id and a.status='ready'),
      'planned_count',(select count(*) from public.canonical_event_actions a where a.event_id=ce.id and a.status='planned'),
      'applied_count',(select count(*) from public.canonical_event_actions a where a.event_id=ce.id and a.status='applied'),
      'skipped_count',(select count(*) from public.canonical_event_actions a where a.event_id=ce.id and a.status='skipped'),
      'failed_count',(select count(*) from public.canonical_event_actions a where a.event_id=ce.id and a.status='failed'),
      'state_changing_count',(select count(*) from public.canonical_event_actions a join public.canonical_event_action_types t on t.key=a.action_type_key where a.event_id=ce.id and t.changes_state),
      'manual_review_count',(select count(*) from public.canonical_event_actions a join public.canonical_event_action_types t on t.key=a.action_type_key where a.event_id=ce.id and t.requires_manual_review),
      'can_generate_plan',ce.status in ('draft','pending_review','approved'),
      'can_apply_now',ce.status='approved' and cet.applies_to='organization_unit' and not exists(select 1 from public.canonical_event_actions a where a.event_id=ce.id and a.status in ('planned','failed')),
      'apply_lock_reason',case
        when cet.applies_to<>'organization_unit' then 'entity_application_not_enabled'
        when ce.status<>'approved' then 'event_not_approved'
        when exists(select 1 from public.canonical_event_actions a where a.event_id=ce.id and a.status in ('planned','failed')) then 'event_actions_not_ready'
        else null
      end
    )
  )
  from public.canonical_events ce
  join public.canonical_event_types cet on cet.id=ce.event_type_id
  where ce.id=p_event_id;
$function$;

revoke all on function public.get_event_application_plan(uuid) from public, anon;
grant execute on function public.get_event_application_plan(uuid) to authenticated;

comment on function public.get_event_application_plan(uuid) is
  'Read-only deterministic projection used to preview event impact before approval or application.';
