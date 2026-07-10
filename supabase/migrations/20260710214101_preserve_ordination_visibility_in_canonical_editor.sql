create or replace view public.person_public_ordination_history
with (security_invoker = true)
as
select
  oe.person_id,
  oe.degree,
  oe.ordination_date,
  oe.ordination_place,
  oe.principal_ordainer_person_id,
  coalesce(principal.display_name, oe.principal_ordainer_name) as principal_ordainer_name,
  principal.slug as principal_ordainer_slug,
  oe.assistant_ordainer_1_person_id,
  coalesce(assistant_1.display_name, oe.assistant_ordainer_1_name) as assistant_ordainer_1_name,
  assistant_1.slug as assistant_ordainer_1_slug,
  oe.assistant_ordainer_2_person_id,
  coalesce(assistant_2.display_name, oe.assistant_ordainer_2_name) as assistant_ordainer_2_name,
  assistant_2.slug as assistant_ordainer_2_slug,
  oe.source_name,
  oe.source_url,
  oe.source_checked_at,
  oe.verification_status,
  oe.notes_public,
  oe.visibility
from public.ordination_events oe
left join public.persons principal on principal.id = oe.principal_ordainer_person_id
left join public.persons assistant_1 on assistant_1.id = oe.assistant_ordainer_1_person_id
left join public.persons assistant_2 on assistant_2.id = oe.assistant_ordainer_2_person_id
where oe.record_status = 'active';

revoke all on public.person_public_ordination_history from public, anon, authenticated;
grant select on public.person_public_ordination_history to anon, authenticated;

comment on column public.person_public_ordination_history.visibility
  is 'Visibilidad vigente del evento, expuesta para que la edición canónica preserve el valor actual.';
