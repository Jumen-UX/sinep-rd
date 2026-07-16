create or replace view public.canonical_institutional_timeline
with (security_invoker = true)
as
select
  ce.id as event_id,
  ce.title,
  ce.description,
  cet.key as event_type_key,
  cet.name as event_type_name,
  cet.institutional_family,
  cet.applies_to,
  ce.status as workflow_status,
  ce.load_mode,
  ce.event_date,
  ce.effective_date,
  ce.approved_at,
  ce.applied_at,
  ce.evidence_status,
  ce.verification_status,
  ce.source_name_text as source_name,
  ce.source_url_text as source_url,
  ce.source_checked_at,
  cep.id as participant_id,
  cep.role as participant_role,
  case
    when cep.entity_id is not null then 'entity'
    when cep.organization_unit_id is not null then 'organization_unit'
    else 'unknown'
  end as participant_kind,
  cep.entity_id,
  ee.name as entity_name,
  ee.slug as entity_slug,
  cep.organization_unit_id,
  ou.name as organization_unit_name,
  ou.slug as organization_unit_slug,
  cep.before_state,
  cep.after_state,
  coalesce(ce.effective_date, ce.event_date, ce.created_at::date) as timeline_date
from public.canonical_events ce
join public.canonical_event_types cet on cet.id = ce.event_type_id
left join public.canonical_event_participants cep on cep.event_id = ce.id
left join public.ecclesiastical_entities ee on ee.id = cep.entity_id
left join public.organization_units ou on ou.id = cep.organization_unit_id;

comment on view public.canonical_institutional_timeline is
  'Proyección cronológica canónica de eventos y participantes. Incluye todos los estados para revisión administrativa y no modifica el estado vigente.';

create or replace view public.public_canonical_institutional_timeline
with (security_invoker = true)
as
select *
from public.canonical_institutional_timeline
where workflow_status = 'applied'
  and (
    (participant_kind = 'entity' and exists (
      select 1 from public.ecclesiastical_entities entity_row
      where entity_row.id = canonical_institutional_timeline.entity_id
        and entity_row.visibility = 'public'
    ))
    or
    (participant_kind = 'organization_unit' and exists (
      select 1 from public.organization_units unit_row
      where unit_row.id = canonical_institutional_timeline.organization_unit_id
        and unit_row.visibility = 'public'
    ))
  );

comment on view public.public_canonical_institutional_timeline is
  'Cronología institucional pública derivada exclusivamente de eventos canónicos aplicados y destinos públicos.';

create or replace function public.get_institutional_state_reconstruction(
  p_entity_id uuid default null,
  p_organization_unit_id uuid default null
)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  with target_guard as (
    select
      case
        when p_entity_id is not null and p_organization_unit_id is not null then false
        when p_entity_id is null and p_organization_unit_id is null then false
        else true
      end as valid_target
  ),
  applied_history as (
    select timeline.*
    from public.canonical_institutional_timeline timeline
    where timeline.workflow_status = 'applied'
      and (
        (p_entity_id is not null and timeline.entity_id = p_entity_id)
        or
        (p_organization_unit_id is not null and timeline.organization_unit_id = p_organization_unit_id)
      )
    order by timeline.timeline_date, timeline.applied_at, timeline.event_id, timeline.participant_id
  ),
  latest_projection as (
    select history.after_state, history.event_id, history.timeline_date
    from applied_history history
    where history.after_state is not null
    order by history.timeline_date desc, history.applied_at desc, history.event_id desc, history.participant_id desc
    limit 1
  ),
  current_state as (
    select jsonb_strip_nulls(jsonb_build_object(
      'id', entity_row.id,
      'name', entity_row.name,
      'official_name', entity_row.official_name,
      'status', entity_row.status,
      'visibility', entity_row.visibility,
      'erected_at', entity_row.erected_at,
      'suppressed_at', entity_row.suppressed_at
    )) as data
    from public.ecclesiastical_entities entity_row
    where entity_row.id = p_entity_id
    union all
    select jsonb_strip_nulls(jsonb_build_object(
      'id', unit_row.id,
      'name', unit_row.name,
      'parent_unit_id', unit_row.parent_unit_id,
      'status', unit_row.status,
      'visibility', unit_row.visibility,
      'valid_from', unit_row.valid_from,
      'valid_to', unit_row.valid_to,
      'is_current', unit_row.is_current
    )) as data
    from public.organization_units unit_row
    where unit_row.id = p_organization_unit_id
  )
  select jsonb_build_object(
    'valid_target', (select valid_target from target_guard),
    'target_kind', case when p_entity_id is not null then 'entity' else 'organization_unit' end,
    'target_id', coalesce(p_entity_id, p_organization_unit_id),
    'applied_event_count', (select count(*) from applied_history),
    'latest_applied_event_id', (select event_id from latest_projection),
    'latest_timeline_date', (select timeline_date from latest_projection),
    'reconstructed_state', (select after_state from latest_projection),
    'current_state', (select data from current_state limit 1),
    'reconstruction_available', exists(select 1 from latest_projection),
    'matches_current_state', case
      when not exists(select 1 from latest_projection) then null
      else (select after_state from latest_projection) <@ coalesce((select data from current_state limit 1), '{}'::jsonb)
    end,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id', event_id,
        'event_type_key', event_type_key,
        'title', title,
        'timeline_date', timeline_date,
        'participant_role', participant_role,
        'before_state', before_state,
        'after_state', after_state
      ) order by timeline_date, applied_at, event_id, participant_id)
      from applied_history
    ), '[]'::jsonb)
  );
$function$;

comment on function public.get_institutional_state_reconstruction(uuid, uuid) is
  'Reconstruye el último estado proyectado desde eventos canónicos aplicados y lo compara con el registro vigente. Es de solo lectura.';

revoke all on public.canonical_institutional_timeline from public, anon;
grant select on public.canonical_institutional_timeline to authenticated;

grant select on public.public_canonical_institutional_timeline to anon, authenticated;

revoke all on function public.get_institutional_state_reconstruction(uuid, uuid) from public, anon;
grant execute on function public.get_institutional_state_reconstruction(uuid, uuid) to authenticated;
