export type ImportBatchType = 'personas' | 'parroquias' | 'asignaciones' | 'eventos'

export type PrepareImportBatchInput = {
  importType: ImportBatchType
  templateVersion?: number
  file: {
    name: string
    extension: 'csv' | 'xlsx' | 'xls'
    mimeType: string | null
    sizeBytes: number
    sha256: string
    lastModifiedAt: string | null
  }
  headers: string[]
  rows: Record<string, string>[]
  scopeEntityId?: string | null
  sourceMetadata?: Record<string, unknown>
}

export type ImportBatchSummary = {
  batch_id: string
  status: 'needs_review' | 'validated' | 'failed' | string
  row_count: number
  valid_rows: number
  warning_rows: number
  error_rows: number
  duplicate_rows: number
  unresolved_rows: number
  can_apply: false
  application_rpc_available: false
  audit_log_id?: string
}

export async function prepareImportBatch(input: PrepareImportBatchInput): Promise<ImportBatchSummary> {
  const response = await fetch('/api/admin/importaciones/preparar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      import_type: input.importType,
      template_version: input.templateVersion ?? 1,
      scope_entity_id: input.scopeEntityId ?? null,
      file: {
        name: input.file.name,
        extension: input.file.extension,
        mime_type: input.file.mimeType,
        size_bytes: input.file.sizeBytes,
        sha256: input.file.sha256,
        last_modified_at: input.file.lastModifiedAt,
      },
      headers: input.headers,
      rows: input.rows,
      source_metadata: input.sourceMetadata ?? {},
    }),
  })

  const payload = await response.json().catch(() => null) as ImportBatchSummary | { error?: string } | null

  if (!response.ok) {
    throw new Error(payload && 'error' in payload && payload.error ? payload.error : 'No se pudo preparar el lote de importación.')
  }

  return payload as ImportBatchSummary
}
