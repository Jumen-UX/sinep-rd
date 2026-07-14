import type { SupabaseClient } from '@supabase/supabase-js'

export type EventRegistryRow = {
  source_kind: string
  event_id: string
  event_date: string | null
  event_year: number | null
  event_month: number | null
  event_day: number | null
  title: string
  event_type_key: string | null
  event_type_name: string | null
  related_entity_id: string | null
  related_entity_name: string | null
  related_entity_type_key: string | null
  source_name: string | null
  source_url: string | null
  evidence_status: string | null
  load_mode: string
  workflow_status: string
}

export type EventRegistryFacet = {
  key?: string
  name?: string
  month?: number
  count: number
}

export type EventRegistrySummary = {
  total_events: number
  historical_events: number
  new_events: number
  calendar_occurrences: number
  verified_or_documented: number
  pending_evidence: number
  min_year: number | null
  max_year: number | null
  months: EventRegistryFacet[]
  event_types: EventRegistryFacet[]
  load_modes: EventRegistryFacet[]
}

export type EventRegistryFilters = {
  year: number | null
  month: number | null
  eventType: string | null
  limit?: number
}

export type EventRegistryData = {
  summary: EventRegistrySummary | null
  events: EventRegistryRow[]
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function hasEventRegistrySession(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser()
  return !error && Boolean(data.user)
}

export async function loadEventRegistry(
  supabase: SupabaseClient,
  filters: EventRegistryFilters,
): Promise<EventRegistryData> {
  const [summaryResult, eventsResult] = await Promise.all([
    supabase.rpc('get_event_registry_summary'),
    supabase.rpc('get_event_registry_stream', {
      p_year: filters.year,
      p_month: filters.month,
      p_event_type: filters.eventType,
      p_entity_id: null,
      p_limit: filters.limit ?? 180,
    }),
  ])

  throwIfError(summaryResult.error, 'No se pudo cargar el resumen de eventos.')
  throwIfError(eventsResult.error, 'No se pudo cargar el registro de eventos.')

  return {
    summary: (summaryResult.data ?? null) as EventRegistrySummary | null,
    events: (eventsResult.data ?? []) as EventRegistryRow[],
  }
}
