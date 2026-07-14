export type ReviewDecision =
  | 'approve_internal'
  | 'publish'
  | 'needs_correction'
  | 'dispute'
  | 'keep_internal'
  | 'reject'
  | 'resolve'
  | 'not_applicable'
  | 'approved'
  | 'needs_changes'
  | 'rejected'

export type ReviewItem = {
  item_key: string
  item_type: string
  record_table: string
  record_id: string | null
  source_id: string | null
  title: string | null
  detail: string | null
  verification_status: string | null
  issue_count: number | null
  created_at: string | null
  allowed_actions: ReviewDecision[] | null
}

type ReviewQueueResponse = {
  items?: ReviewItem[]
  error?: string
}

type ReviewActionResponse = {
  error?: string
}

export const reviewActionLabels: Record<ReviewDecision, string> = {
  approve_internal: 'Aprobar interno',
  publish: 'Publicar',
  needs_correction: 'Solicitar corrección',
  dispute: 'Marcar disputa',
  keep_internal: 'Mantener interno',
  reject: 'Ignorar candidato',
  resolve: 'Marcar resuelto',
  not_applicable: 'No aplica',
  approved: 'Aprobar solicitud',
  needs_changes: 'Pedir cambios',
  rejected: 'Rechazar solicitud',
}

const statusLabels: Record<string, string> = {
  unknown: 'No identificado',
  pending: 'Pendiente',
  pending_review: 'Pendiente de revisión',
  not_identified: 'No identificado',
  incomplete: 'Incompleto',
  not_verified: 'No verificado',
  needs_review: 'Requiere revisión',
  needs_correction: 'Requiere corrección',
  needs_changes: 'Requiere cambios',
  disputed: 'En disputa',
  verified: 'Verificado',
  matched: 'Coincidencia aprobada',
  ignored: 'Ignorado',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  published: 'Publicado',
  internal: 'Uso interno',
  not_applicable: 'No aplica',
}

export function formatReviewDate(value: string | null) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no válida'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(date)
}

export function getReviewItemTypeLabel(value: string) {
  if (value === 'missing_field') return 'Dato faltante'
  if (value === 'position_assignment') return 'Cargo por verificar'
  if (value === 'person_candidate') return 'Persona por revisar'
  if (value === 'change_request') return 'Solicitud de cambio'
  return value
}

export function getReviewStatusLabel(value: string | null) {
  if (!value) return 'Pendiente'
  return statusLabels[value] ?? value
}

export function isPrimaryReviewAction(decision: ReviewDecision) {
  return ['approve_internal', 'publish', 'resolve', 'approved'].includes(decision)
}

export function getReviewDecisionPrompt(decision: ReviewDecision) {
  if (decision === 'publish') return 'Nota de publicación. Deja vacío si no aplica.'
  if (decision === 'needs_correction' || decision === 'needs_changes') return 'Describe la corrección requerida.'
  if (decision === 'rejected' || decision === 'reject') return 'Indica el motivo de rechazo o descarte.'
  return 'Nota interna de revisión. Deja vacío si no aplica.'
}

export async function loadReviewQueue(): Promise<ReviewItem[]> {
  const response = await fetch('/api/admin/revision')
  const data = await response.json() as ReviewQueueResponse
  if (!response.ok) throw new Error(data.error ?? 'No se pudo cargar la cola de revisión.')
  return data.items ?? []
}

export async function submitReviewDecision(
  item: ReviewItem,
  decision: ReviewDecision,
  notes: string,
  publishPerson: boolean,
) {
  const response = await fetch('/api/admin/revision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      item_type: item.item_type,
      record_id: item.record_id,
      source_id: item.source_id,
      decision,
      notes,
      publish_person: publishPerson,
    }),
  })

  const data = await response.json() as ReviewActionResponse
  if (!response.ok) throw new Error(data.error ?? 'No se pudo completar la revisión.')
}
