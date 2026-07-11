export type ImportBatchType = 'personas' | 'parroquias' | 'asignaciones' | 'eventos'

export type ImportBatchStatus =
  | 'prepared'
  | 'validating'
  | 'needs_review'
  | 'validated'
  | 'applying'
  | 'applied'
  | 'failed'
  | 'cancelled'
  | (string & {})

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
  status: ImportBatchStatus
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

export type ImportBatchListItem = {
  id: string
  import_type: ImportBatchType
  status: ImportBatchStatus
  file_name: string
  file_size_bytes: number
  file_sha256: string
  scope_entity_id: string | null
  row_count: number
  valid_rows: number
  warning_rows: number
  error_rows: number
  duplicate_rows: number
  unresolved_rows: number
  created_by: string
  validated_at: string | null
  created_at: string
  updated_at: string
}

export type ImportBatchRowIssue = {
  id: string
  batch_id: string
  row_id: string
  issue_type: 'validation_error' | 'warning' | 'duplicate' | 'unresolved_relation'
  code: string
  field_name: string | null
  message: string
  details: Record<string, unknown>
  status: 'open' | 'resolved' | 'ignored' | 'superseded'
  resolved_by: string | null
  resolved_at: string | null
  resolution_notes: string | null
  created_at: string
}

export type ImportBatchRowDetail = {
  id: string
  batch_id: string
  row_number: number
  status: 'pending' | 'valid' | 'warning' | 'error' | 'duplicate' | 'unresolved' | 'ready' | 'applied' | 'skipped' | 'failed'
  raw_data: Record<string, unknown>
  normalized_data: Record<string, unknown>
  row_hash: string
  resolved_relations: Record<string, unknown>
  target_operation: 'create' | 'update' | 'noop' | null
  target_schema: string | null
  target_table: string | null
  target_record_id: string | null
  corrected_by: string | null
  corrected_at: string | null
  applied_at: string | null
  created_at: string
  updated_at: string
}

export type ImportBatchDetail = {
  batch: ImportBatchListItem & {
    template_version: number
    file_extension: 'csv' | 'xlsx' | 'xls'
    file_mime_type: string | null
    file_last_modified_at: string | null
    source_metadata: Record<string, unknown>
    validated_by: string | null
    applied_rows: number
    validation_summary: Record<string, unknown>
    last_error: string | null
    reviewed_at: string | null
    applied_at: string | null
  }
  rows: ImportBatchRowDetail[]
  issues: ImportBatchRowIssue[]
}

function readErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('error' in payload)) return null
  const error = (payload as { error?: unknown }).error
  return typeof error === 'string' && error.trim() ? error : null
}

async function readPayload<T>(response: Response, fallback: string): Promise<T> {
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(readErrorMessage(payload) ?? fallback)
  }

  return payload as T
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

  return readPayload<ImportBatchSummary>(response, 'No se pudo preparar el lote de importación.')
}

export async function listImportBatches(options?: {
  status?: ImportBatchStatus
  limit?: number
}): Promise<ImportBatchListItem[]> {
  const searchParams = new URLSearchParams()
  searchParams.set('limit', String(options?.limit ?? 20))
  if (options?.status) searchParams.set('status', options.status)

  const response = await fetch(`/api/admin/importaciones?${searchParams.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })
  const payload = await readPayload<{ batches: ImportBatchListItem[] }>(
    response,
    'No se pudieron consultar los lotes de importación.',
  )
  return payload.batches
}

export async function getImportBatchDetail(batchId: string): Promise<ImportBatchDetail> {
  const response = await fetch(`/api/admin/importaciones/${encodeURIComponent(batchId)}`, {
    method: 'GET',
    cache: 'no-store',
  })
  return readPayload<ImportBatchDetail>(response, 'No se pudo consultar el detalle del lote.')
}

export async function revalidateImportBatch(batchId: string): Promise<ImportBatchSummary> {
  const response = await fetch(`/api/admin/importaciones/${encodeURIComponent(batchId)}/validar`, {
    method: 'POST',
  })
  return readPayload<ImportBatchSummary>(response, 'No se pudo revalidar el lote de importación.')
}

export async function updateImportBatchRow(
  rowId: string,
  normalizedData: Record<string, string>,
): Promise<ImportBatchSummary & { row_id: string }> {
  const response = await fetch(`/api/admin/importaciones/filas/${encodeURIComponent(rowId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ normalized_data: normalizedData }),
  })
  return readPayload<ImportBatchSummary & { row_id: string }>(
    response,
    'No se pudo corregir la fila de importación.',
  )
}
