export type ImportApplicationPreviewRow = {
  status: string
  target_operation: string | null
  target_table: string | null
  target_record_id: string | null
}

export type ImportApplicationPreview = {
  totalRows: number
  createRows: number
  noopRows: number
  completedRows: number
  blockedRows: number
  unresolvedTargets: number
  targetTables: Array<{ table: string; count: number }>
  canApply: boolean
  isCompleted: boolean
}

const applicableStatuses = new Set(['valid', 'warning'])
const completedStatuses = new Set(['applied', 'skipped'])

export function buildImportApplicationPreview(
  rows: ImportApplicationPreviewRow[],
): ImportApplicationPreview {
  let createRows = 0
  let noopRows = 0
  let completedRows = 0
  let blockedRows = 0
  let unresolvedTargets = 0
  const tableCounts = new Map<string, number>()

  for (const row of rows) {
    const isApplicable = applicableStatuses.has(row.status)
    const isCompleted = completedStatuses.has(row.status)

    if (!isApplicable && !isCompleted) blockedRows += 1
    if (isCompleted) completedRows += 1

    if (row.target_operation === 'create') createRows += 1
    if (row.target_operation === 'noop') noopRows += 1

    if (!row.target_table || (row.target_operation === 'noop' && !row.target_record_id)) {
      unresolvedTargets += 1
    }

    if (row.target_table) {
      tableCounts.set(row.target_table, (tableCounts.get(row.target_table) ?? 0) + 1)
    }
  }

  const targetTables = [...tableCounts.entries()]
    .map(([table, count]) => ({ table, count }))
    .sort((left, right) => right.count - left.count || left.table.localeCompare(right.table))

  const isCompleted = rows.length > 0 && completedRows === rows.length

  return {
    totalRows: rows.length,
    createRows,
    noopRows,
    completedRows,
    blockedRows,
    unresolvedTargets,
    targetTables,
    canApply: rows.length > 0 && completedRows === 0 && blockedRows === 0 && unresolvedTargets === 0,
    isCompleted,
  }
}
