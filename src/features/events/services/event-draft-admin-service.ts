import type { SupabaseClient } from '@supabase/supabase-js'

export type EventLoadMode = 'carga_historica' | 'evento_nuevo' | 'foto_inicial'

export type EventTypeOption = {
  key: string
  name: string
  description: string | null
  applies_to: string
}

export type EventEntityOption = {
  id: string
  name: string
  official_name: string | null
  entity_types?: { key: string; name: string } | null
}

export type EvidenceOption = {
  key: string
  name: string
  description: string
}

export type EventDraftInput = {
  loadMode: EventLoadMode
  eventTypeKey: string
  eventDate: string
  effectiveDate: string
  title: string
  description: string
  entityId: string
  entityRole: string
  sourceName: string
  sourceUrl: string
  evidenceStatus: string
  notes: string
}

export const eventLoadModes: Array<{ key: EventLoadMode; title: string; description: string }> = [
  {
    key: 'carga_historica',
    title: 'Carga histórica',
    description: 'Reconstruye un hecho pasado: erección, elevación, desmembramiento, cambio territorial, nombramiento u otro evento histórico.',
  },
  {
    key: 'evento_nuevo',
    title: 'Evento nuevo',
    description: 'Registra un cambio presente o futuro detectado por documento, boletín, decreto o validación oficial.',
  },
  {
    key: 'foto_inicial',
    title: 'Foto inicial vigente',
    description: 'Carga el estado actual conocido cuando todavía falta reconstruir el evento originario o documento completo.',
  },
]

export const eventEvidenceOptions: EvidenceOption[] = [
  { key: 'confirmado_oficial', name: 'Confirmado oficial', description: 'Tiene documento oficial o fuente primaria validada.' },
  { key: 'fuente_secundaria', name: 'Fuente secundaria', description: 'Sustentado por directorio, página diocesana, base histórica u otra fuente confiable.' },
  { key: 'importado_vigente', name: 'Importado vigente', description: 'Dato de foto inicial del sistema, pendiente de reconstrucción documental completa.' },
  { key: 'pendiente_documento', name: 'Documento pendiente', description: 'Dato conocido, pero falta el documento de respaldo.' },
  { key: 'contradictorio', name: 'Contradictorio', description: 'Existen fuentes que no coinciden y requiere revisión.' },
  { key: 'corregido', name: 'Corregido', description: 'Dato corregido por una fuente posterior o validación editorial.' },
]

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function hasEventAdminSession(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser()
  return !error && Boolean(data.user)
}

export async function loadEventDraftOptions(supabase: SupabaseClient) {
  const [eventTypeResult, entityResult] = await Promise.all([
    supabase
      .from('canonical_event_types')
      .select('key,name,description,applies_to')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('ecclesiastical_entities')
      .select('id,name,official_name,entity_types(key,name)')
      .eq('status', 'active')
      .eq('visibility', 'public')
      .order('name')
      .limit(250),
  ])

  throwIfError(eventTypeResult.error, 'No se pudieron cargar los tipos de evento.')
  throwIfError(entityResult.error, 'No se pudieron cargar las entidades disponibles.')

  return {
    eventTypes: (eventTypeResult.data ?? []) as EventTypeOption[],
    entities: (entityResult.data ?? []) as unknown as EventEntityOption[],
  }
}

export async function createEventDraft(supabase: SupabaseClient, input: EventDraftInput) {
  const { error } = await supabase.rpc('admin_create_event_draft', {
    payload: {
      load_mode: input.loadMode,
      event_type_key: input.eventTypeKey,
      event_date: input.eventDate || null,
      effective_date: input.effectiveDate || null,
      title: input.title,
      description: input.description || null,
      entity_id: input.entityId || null,
      entity_role: input.entityRole,
      source_name: input.sourceName || null,
      source_url: input.sourceUrl || null,
      evidence_status: input.evidenceStatus,
      notes: input.notes || null,
    },
  })

  throwIfError(error, 'No se pudo guardar el evento pendiente.')
}
