import type { SupabaseClient } from '@supabase/supabase-js'

export type HistoricalStructuralAction =
  | 'none'
  | 'creation'
  | 'dependency_change'
  | 'suppression'
  | 'restoration'

export type JurisdictionHistoricalEventInput = {
  eventTypeKey: string
  effectiveDate: string
  publicTitle: string
  publicSummary: string
  sourceDocumentId: string
  structuralAction?: HistoricalStructuralAction
  primaryAccountId?: string | null
  structuralPayload?: Record<string, unknown>
}

export type JurisdictionHistoricalEventPreview = {
  valid: boolean
  errors: string[]
  event_type: null | {
    id: string
    key: string
    name: string
    affects_organigram: boolean
  }
  effective_date: string
  title: string
  summary: string
  source_document_id: string
  structural_action: HistoricalStructuralAction
  structural_preview: Record<string, unknown> | null
}

export type JurisdictionHistoricalEventResult = {
  status: 'published'
  historical_operation_id: string
  structural_operation_id: string | null
  audit_id: string
  primary_account_id: string
  structural_result: Record<string, unknown> | null
}

function rpcPayload(input: JurisdictionHistoricalEventInput) {
  return {
    p_event_type_key: input.eventTypeKey,
    p_effective_date: input.effectiveDate,
    p_public_title: input.publicTitle,
    p_public_summary: input.publicSummary,
    p_source_document_id: input.sourceDocumentId,
    p_structural_action: input.structuralAction ?? 'none',
    p_primary_account_id: input.primaryAccountId ?? null,
    p_structural_payload: input.structuralPayload ?? {},
  }
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function previewJurisdictionHistoricalEvent(
  supabase: SupabaseClient,
  input: JurisdictionHistoricalEventInput,
): Promise<JurisdictionHistoricalEventPreview> {
  const { data, error } = await supabase.rpc(
    'admin_preview_jurisdiction_historical_event',
    rpcPayload(input),
  )
  throwIfError(error, 'No se pudo validar el acontecimiento histórico.')
  return data as JurisdictionHistoricalEventPreview
}

export async function applyJurisdictionHistoricalEvent(
  supabase: SupabaseClient,
  input: JurisdictionHistoricalEventInput,
): Promise<JurisdictionHistoricalEventResult> {
  const { data, error } = await supabase.rpc(
    'admin_apply_jurisdiction_historical_event',
    rpcPayload(input),
  )
  throwIfError(error, 'No se pudo registrar el acontecimiento histórico.')
  return data as JurisdictionHistoricalEventResult
}
