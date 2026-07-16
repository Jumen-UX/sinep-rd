export type ImportReversalPlanItem = {
  change_id: string
  row_id: string
  operation: 'create' | 'update' | 'noop'
  target_table: string
  target_record_id: string
  action: 'record_only' | 'restore_event_record' | 'retire_unapplied_event' | 'blocked_manual_canonical_resolution'
}

export type ImportReversalResult = {
  batch_id: string
  status: 'completed' | 'blocked'
  plan: {
    batch_id: string
    items: ImportReversalPlanItem[]
    reversible_count: number
    blocked_count: number
    can_reverse: boolean
  }
  audit_log_id: string
  reversed_at?: string
}

function readErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return null
  const value = (payload as { error?: unknown }).error
  return typeof value === 'string' && value.trim() ? value : null
}

export async function reverseImportBatch(batchId: string, reason: string): Promise<ImportReversalResult> {
  const normalizedReason = reason.trim()
  if (!batchId.trim()) throw new Error('El lote es obligatorio.')
  if (normalizedReason.length < 10) throw new Error('Indica un motivo de reversión de al menos 10 caracteres.')

  const response = await fetch(`/api/admin/importaciones/${encodeURIComponent(batchId)}/revertir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: normalizedReason }),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(readErrorMessage(payload) ?? 'No se pudo revertir lógicamente el lote.')
  }
  return payload as ImportReversalResult
}
