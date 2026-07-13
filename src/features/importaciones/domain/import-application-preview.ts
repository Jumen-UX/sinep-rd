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
  blockedRows: number
  unresolvedTargets: number
  targetTables: Array<{ table: string; count: number }>
  canApply: boolean
}

const applicableStatuses = new Set(['valid', 'warning'])

export function buildImportApplicationPreview(
  rows: ImportApplicationPreviewRow[],
): ImportApplicationPreview {
  let createRows = 0
  let noopRows = 0
  let blockedRows = 0
  let unresolvedTargets = 0
  const tableCounts = new Map<string, number>()

  for (const row of rows) {
    if (!applicableStatuses.has(row.status)) blockedRows += 1

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

  return {
    totalRows: rows.length,
    createRows,
    noopRows,
    blockedRows,
    unresolvedTargets,
    targetTables,
    canApply: rows.length > 0 && blockedRows === 0 && unresolvedTargets === 0,
  }
}
