import type { SupabaseClient } from '@supabase/supabase-js'

export type CorrectableEventField =
  | 'title'
  | 'description'
  | 'event_date'
  | 'effective_date'
  | 'authority_entity_id'
  | 'source_name_text'
  | 'source_url_text'
  | 'source_checked_at'
  | 'verification_status'
  | 'evidence_status'

export type CorrectCanonicalEventInput = {
  eventId: string
  changeReason: string
  changes: Partial<Record<CorrectableEventField, string | null>>
  sourceName?: string
  sourceUrl?: string
  changeRequestId?: string
}

export type CorrectCanonicalEventResult = {
  event_id: string
  revision_number: number
  changed_fields: string[]
  before_state: Record<string, unknown>
  after_state: Record<string, unknown>
}

export type CanonicalEventRevision = {
  id: string
  event_id: string
  revision_number: number
  before_state: Record<string, unknown>
  after_state: Record<string, unknown>
  changed_fields: string[]
  change_reason: string
  source_name: string | null
  source_url: string | null
  changed_by: string | null
  changed_at: string
}

export async function correctCanonicalEvent(
  supabase: SupabaseClient,
  input: CorrectCanonicalEventInput,
): Promise<CorrectCanonicalEventResult> {
  const changeReason = input.changeReason.trim()
  const changedFields = Object.keys(input.changes)

  if (!input.eventId) throw new Error('El evento es obligatorio.')
  if (!changeReason) throw new Error('El motivo de la corrección es obligatorio.')
  if (changedFields.length === 0) throw new Error('Debes indicar al menos un campo para corregir.')

  const { data, error } = await supabase.rpc('admin_correct_canonical_event', {
    payload: {
      event_id: input.eventId,
      change_reason: changeReason,
      changes: input.changes,
      source_name: input.sourceName?.trim() || null,
      source_url: input.sourceUrl?.trim() || null,
      change_request_id: input.changeRequestId || null,
    },
  })

  if (error) throw new Error(error.message || 'No se pudo corregir el evento.')
  if (!data || typeof data !== 'object') throw new Error('Supabase no devolvió la revisión del evento.')

  return data as CorrectCanonicalEventResult
}

export async function loadCanonicalEventRevisions(
  supabase: SupabaseClient,
  eventId: string,
): Promise<CanonicalEventRevision[]> {
  if (!eventId) return []

  const { data, error } = await supabase.rpc('get_event_revision_history', {
    p_event_id: eventId,
  })

  if (error) throw new Error(error.message || 'No se pudo cargar el historial de correcciones.')
  return (Array.isArray(data) ? data : []) as CanonicalEventRevision[]
}
