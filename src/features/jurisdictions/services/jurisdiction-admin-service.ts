import type { SupabaseClient } from '@supabase/supabase-js'

export type JurisdictionCorrectionChanges = Partial<{
  name: string
  official_name: string | null
  latin_name: string | null
  description: string | null
  cathedral_name: string | null
  territory_summary: string | null
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  notes: string | null
  sort_order: number
}>

export type JurisdictionCorrectionResult = {
  status: 'updated' | 'noop'
  account_id: string
  ecclesiastical_entity_id: string
  audit_id?: string
  changed_fields: string[]
  updated_at: string
}

export type JurisdictionDependencyPreview = {
  valid: boolean
  errors: string[]
  warnings: string[]
  child: {
    account_id: string
    account_code: string
    name: string
  }
  current_dependency: null | {
    edge_id: string
    parent_account_id: string
    parent_name: string
    relationship_type: string
    valid_from: string
  }
  proposed_dependency: {
    parent_account_id: string
    parent_account_code: string
    parent_name: string
    relationship_type: string
    effective_date: string
    source_document_id: string | null
  }
  requires_source: boolean
}

export type JurisdictionDependencyChangeInput = {
  childAccountId: string
  newParentAccountId: string
  relationshipType: string
  effectiveDate: string
  reason: string
  sourceDocumentId?: string | null
}

export type JurisdictionDependencyApplyResult = {
  status: 'applied' | 'noop'
  operation_id?: string
  audit_id?: string
  child_account_id: string
  previous_edge_id?: string | null
  current_edge_id: string
  preview: JurisdictionDependencyPreview
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function correctJurisdiction(
  supabase: SupabaseClient,
  accountId: string,
  changes: JurisdictionCorrectionChanges,
  options: { reason?: string | null; expectedUpdatedAt?: string | null } = {},
): Promise<JurisdictionCorrectionResult> {
  const { data, error } = await supabase.rpc('admin_correct_jurisdiction', {
    p_account_id: accountId,
    p_changes: changes,
    p_reason: options.reason ?? null,
    p_expected_updated_at: options.expectedUpdatedAt ?? null,
  })

  throwIfError(error, 'No se pudo guardar la corrección jurisdiccional.')
  return data as JurisdictionCorrectionResult
}

export async function previewJurisdictionDependencyChange(
  supabase: SupabaseClient,
  input: JurisdictionDependencyChangeInput,
): Promise<JurisdictionDependencyPreview> {
  const { data, error } = await supabase.rpc('admin_preview_jurisdiction_dependency_change', {
    p_child_account_id: input.childAccountId,
    p_new_parent_account_id: input.newParentAccountId,
    p_relationship_type: input.relationshipType,
    p_effective_date: input.effectiveDate,
    p_reason: input.reason,
    p_source_document_id: input.sourceDocumentId ?? null,
  })

  throwIfError(error, 'No se pudo validar el cambio de dependencia.')
  return data as JurisdictionDependencyPreview
}

export async function applyJurisdictionDependencyChange(
  supabase: SupabaseClient,
  input: JurisdictionDependencyChangeInput,
  expectedCurrentEdgeId: string | null,
): Promise<JurisdictionDependencyApplyResult> {
  const { data, error } = await supabase.rpc('admin_apply_jurisdiction_dependency_change', {
    p_child_account_id: input.childAccountId,
    p_new_parent_account_id: input.newParentAccountId,
    p_relationship_type: input.relationshipType,
    p_effective_date: input.effectiveDate,
    p_reason: input.reason,
    p_source_document_id: input.sourceDocumentId ?? null,
    p_expected_current_edge_id: expectedCurrentEdgeId,
  })

  throwIfError(error, 'No se pudo aplicar el cambio de dependencia.')
  return data as JurisdictionDependencyApplyResult
}
