begin;

with target_event as (
  select ce.id
  from public.canonical_events ce
  join public.canonical_event_types cet on cet.id = ce.event_type_id
  where cet.key = 'erection'
    and ce.effective_date = date '1511-08-08'
    and ce.title = 'Erección de la Diócesis de Santo Domingo'
    and ce.status = 'pending_review'
    and ce.source_name_text = 'Catholic-Hierarchy PDF de Santo Domingo'
)
update public.canonical_events ce
set source_name_text = 'Catholic-Hierarchy — Archdiocese of Santo Domingo',
    source_url_text = 'https://www.catholic-hierarchy.org/diocese/dsndo.html',
    notes_json = jsonb_set(
      coalesce(ce.notes_json, '{}'::jsonb),
      '{documentary_reference}',
      jsonb_build_object(
        'source_kind', 'secondary_reference',
        'source_name', 'Catholic-Hierarchy — Archdiocese of Santo Domingo',
        'source_url', 'https://www.catholic-hierarchy.org/diocese/dsndo.html',
        'review_note', 'La referencia secundaria confirma la fecha histórica; la aprobación editorial y los efectos estructurales permanecen pendientes.'
      ),
      true
    ),
    updated_at = now()
from target_event te
where ce.id = te.id;

with target_event as (
  select ce.id
  from public.canonical_events ce
  join public.canonical_event_types cet on cet.id = ce.event_type_id
  where cet.key = 'erection'
    and ce.effective_date = date '1511-08-08'
    and ce.title = 'Erección de la Diócesis de Santo Domingo'
    and ce.status = 'pending_review'
    and ce.source_url_text = 'https://www.catholic-hierarchy.org/diocese/dsndo.html'
)
update public.canonical_event_actions cea
set payload = coalesce(cea.payload, '{}'::jsonb) || jsonb_build_object(
      'source_name', 'Catholic-Hierarchy — Archdiocese of Santo Domingo',
      'source_url', 'https://www.catholic-hierarchy.org/diocese/dsndo.html',
      'evidence_status', 'fuente_secundaria',
      'source_document_id', null
    ),
    notes = 'Referencia secundaria enlazada. Requiere confirmación editorial o fuente primaria antes de aprobar.',
    updated_at = now()
from target_event te
where cea.event_id = te.id
  and cea.action_type_key = 'attach_source_reference'
  and cea.status = 'planned';

commit;
