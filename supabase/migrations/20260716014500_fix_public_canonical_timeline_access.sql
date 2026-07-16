create or replace view public.public_canonical_institutional_timeline
with (security_barrier = true)
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
join public.canonical_event_participants cep on cep.event_id = ce.id
left join public.ecclesiastical_entities ee on ee.id = cep.entity_id
left join public.organization_units ou on ou.id = cep.organization_unit_id
where ce.status = 'applied'
  and (
    (cep.entity_id is not null and ee.visibility = 'public')
    or
    (cep.organization_unit_id is not null and ou.visibility = 'public')
  );

comment on view public.public_canonical_institutional_timeline is
  'Cronología institucional pública derivada exclusivamente de eventos canónicos aplicados y destinos públicos. La vista no concede acceso a la cronología administrativa.';

revoke all on public.public_canonical_institutional_timeline from public;
grant select on public.public_canonical_institutional_timeline to anon, authenticated;
