export type ImportApplicationPreviewRow = {
  id?: string
  row_number?: number
  status: string
  target_operation: string | null
  target_table: string | null
  target_record_id: string | null
}

export type ImportProjectedOperation = 'create' | 'update' | 'noop' | 'blocked' | 'unresolved' | 'completed'

export type ImportProjectedRow = {
  id: string | null
  rowNumber: number | null
  operation: ImportProjectedOperation
  targetTable: string | null
  targetRecordId: string | null
  reason: string
}

export type ImportApplicationPreview = {
  totalRows: number
  createRows: number
  updateRows: number
  noopRows: number
  completedRows: number
  blockedRows: number
  unresolvedRows: number
  unresolvedTargets: number
  targetTables: Array<{ table: string; count: number }>
  rows: ImportProjectedRow[]
  canApply: boolean
  isCompleted: boolean
}

const applicableStatuses = new Set(['valid', 'warning'])
const completedStatuses = new Set(['applied', 'skipped'])
const supportedOperations = new Set(['create', 'update', 'noop'])

export function projectImportRowOperation(row: ImportApplicationPreviewRow): ImportProjectedRow {
  const base = {
    id: row.id ?? null,
    rowNumber: row.row_number ?? null,
    targetTable: row.target_table,
    targetRecordId: row.target_record_id,
  }

  if (completedStatuses.has(row.status)) {
    return { ...base, operation: 'completed', reason: 'La fila ya fue procesada.' }
  }

  if (row.status === 'unresolved') {
    return { ...base, operation: 'unresolved', reason: 'La fila contiene una referencia canónica pendiente.' }
  }

  if (!applicableStatuses.has(row.status)) {
    return { ...base, operation: 'blocked', reason: 'La fila contiene errores o coincidencias que requieren revisión.' }
  }

  if (!row.target_operation || !supportedOperations.has(row.target_operation) || !row.target_table) {
    return { ...base, operation: 'unresolved', reason: 'La validación no determinó una operación y tabla objetivo.' }
  }

  if ((row.target_operation === 'update' || row.target_operation === 'noop') && !row.target_record_id) {
    return { ...base, operation: 'unresolved', reason: 'La operación requiere un registro canónico objetivo.' }
  }

  return {
    ...base,
    operation: row.target_operation as 'create' | 'update' | 'noop',
    reason: row.target_operation === 'create'
      ? 'Se creará un registro canónico.'
      : row.target_operation === 'update'
        ? 'Se actualizará el registro canónico identificado.'
        : 'La coincidencia exacta no requiere cambios.',
  }
}

export function buildImportApplicationPreview(
  sourceRows: ImportApplicationPreviewRow[],
): ImportApplicationPreview {
  const rows = sourceRows.map(projectImportRowOperation)
  const count = (operation: ImportProjectedOperation) => rows.filter((row) => row.operation === operation).length
  const createRows = count('create')
  const updateRows = count('update')
  const noopRows = count('noop')
  const completedRows = count('completed')
  const blockedRows = count('blocked')
  const unresolvedRows = count('unresolved')
  const tableCounts = new Map<string, number>()

  for (const row of rows) {
    if (row.targetTable && ['create', 'update', 'noop', 'completed'].includes(row.operation)) {
      tableCounts.set(row.targetTable, (tableCounts.get(row.targetTable) ?? 0) + 1)
    }
  }

  const targetTables = [...tableCounts.entries()]
    .map(([table, tableCount]) => ({ table, count: tableCount }))
    .sort((left, right) => right.count - left.count || left.table.localeCompare(right.table))

  const isCompleted = rows.length > 0 && completedRows === rows.length

  return {
    totalRows: rows.length,
    createRows,
    updateRows,
    noopRows,
    completedRows,
    blockedRows,
    unresolvedRows,
    unresolvedTargets: unresolvedRows,
    targetTables,
    rows,
    canApply: rows.length > 0 && completedRows === 0 && blockedRows === 0 && unresolvedRows === 0,
    isCompleted,
  }
}
