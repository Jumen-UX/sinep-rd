import type { SupabaseClient } from '@supabase/supabase-js'

export type CompensationKind = 'reversal' | 'correction' | 'supersession'

export type CreateCompensatingEventInput = {
  originalEventId: string
  reason: string
  correctionKind: CompensationKind
  title?: string
  description?: string
  eventDate: string
  effectiveDate?: string
  sourceName?: string
  sourceUrl?: string
  sourceCheckedAt?: string
}

export async function createCompensatingEvent(
  supabase: SupabaseClient,
  input: CreateCompensatingEventInput,
): Promise<string> {
  const reason = input.reason.trim()
  if (!input.originalEventId) throw new Error('El evento original es obligatorio.')
  if (!reason) throw new Error('El motivo de la corrección es obligatorio.')
  if (!input.eventDate) throw new Error('La fecha del evento correctivo es obligatoria.')

  const { data, error } = await supabase.rpc('admin_create_compensating_event', {
    payload: {
      original_event_id: input.originalEventId,
      reason,
      correction_kind: input.correctionKind,
      title: input.title?.trim() || null,
      description: input.description?.trim() || null,
      event_date: input.eventDate,
      effective_date: input.effectiveDate || input.eventDate,
      source_name: input.sourceName?.trim() || null,
      source_url: input.sourceUrl?.trim() || null,
      source_checked_at: input.sourceCheckedAt || null,
    },
  })

  if (error) throw new Error(error.message || 'No se pudo crear el evento compensatorio.')
  if (typeof data !== 'string' || !data) throw new Error('Supabase no devolvió el identificador de la corrección.')
  return data
}
