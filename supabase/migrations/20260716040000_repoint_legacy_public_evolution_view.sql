-- Conserva el contrato público heredado, pero elimina su dependencia operativa
-- de entity_evolution_events. Solo proyecta hechos canónicos aplicados y públicos.

update public.canonical_events ce
set notes_json = coalesce(ce.notes_json, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
  'legacy_from_entity_name', legacy.from_entity_name,
  'legacy_to_entity_name', legacy.to_entity_name,
  'legacy_related_entity_name', legacy.related_entity_name
))
from public.entity_evolution_events legacy
where ce.notes_json ->> 'legacy_entity_evolution_event_id' = legacy.id::text
  and ce.notes_json ->> 'legacy_source_table' = 'entity_evolution_events';

create or replace view public.public_entity_evolution_events as
select
  ce.id,
  primary_entity.entity_id,
  primary_entity.name as entity_name,
  primary_entity.slug as entity_slug,
  coalesce(ce.notes_json ->> 'legacy_event_type', cet.key) as event_type,
  ce.event_date,
  ce.title,
  ce.description,
  origin_entity.entity_id as from_entity_id,
  origin_entity.name as from_entity_display_name,
  origin_entity.slug as from_entity_slug,
  coalesce(origin_entity.name, ce.notes_json ->> 'legacy_from_entity_name') as from_entity_name,
  destination_entity.entity_id as to_entity_id,
  destination_entity.name as to_entity_display_name,
  destination_entity.slug as to_entity_slug,
  coalesce(destination_entity.name, ce.notes_json ->> 'legacy_to_entity_name') as to_entity_name,
  related_entity.entity_id as related_entity_id,
  related_entity.name as related_entity_display_name,
  related_entity.slug as related_entity_slug,
  coalesce(related_entity.name, ce.notes_json ->> 'legacy_related_entity_name') as related_entity_name,
  ce.notes_json ->> 'territory_summary' as territory_summary,
  ce.notes_json ->> 'canonical_effect' as canonical_effect,
  ce.source_name_text as source_name,
  ce.source_url_text as source_url,
  coalesce(ce.source_checked_at, nullif(ce.notes_json ->> 'legacy_source_checked_at', '')::date) as source_checked_at,
  coalesce(ce.verification_status, ce.notes_json ->> 'legacy_verification_status') as verification_status,
  ce.notes_json ->> 'notes_public' as notes_public
from public.canonical_events ce
join public.canonical_event_types cet on cet.id = ce.event_type_id
left join lateral (
  select cep.entity_id, entity.name, entity.slug
  from public.canonical_event_participants cep
  join public.ecclesiastical_entities entity on entity.id = cep.entity_id
  where cep.event_id = ce.id
    and cep.entity_id is not null
  order by
    case cep.role
      when 'created_entity' then 1
      when 'suppressed_entity' then 1
      when 'affected_jurisdiction' then 1
      when 'primary' then 1
      else 2
    end,
    cep.id
  limit 1
) primary_entity on true
left join lateral (
  select cep.entity_id, entity.name, entity.slug
  from public.canonical_event_participants cep
  join public.ecclesiastical_entities entity on entity.id = cep.entity_id
  where cep.event_id = ce.id and cep.role = 'origin_entity'
  order by cep.id limit 1
) origin_entity on true
left join lateral (
  select cep.entity_id, entity.name, entity.slug
  from public.canonical_event_participants cep
  join public.ecclesiastical_entities entity on entity.id = cep.entity_id
  where cep.event_id = ce.id and cep.role = 'destination_entity'
  order by cep.id limit 1
) destination_entity on true
left join lateral (
  select cep.entity_id, entity.name, entity.slug
  from public.canonical_event_participants cep
  join public.ecclesiastical_entities entity on entity.id = cep.entity_id
  where cep.event_id = ce.id and cep.role in ('source_entity', 'related_entity')
  order by case cep.role when 'source_entity' then 1 else 2 end, cep.id limit 1
) related_entity on true
where ce.status = 'applied'
  and exists (
    select 1
    from public.public_canonical_institutional_timeline timeline
    where timeline.event_id = ce.id
  );

comment on view public.public_entity_evolution_events is
  'Vista de compatibilidad heredada proyectada exclusivamente desde eventos canónicos aplicados y públicos.';

revoke all on public.public_entity_evolution_events from public;
grant select on public.public_entity_evolution_events to anon, authenticated;
