import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const preview = fs.readFileSync('src/features/importaciones/domain/import-application-preview.ts', 'utf8')
const panel = fs.readFileSync('src/features/importaciones/admin/ImportApplicationPreviewPanel.tsx', 'utf8')

test('each import row projects to one deterministic operation', () => {
  assert.match(preview, /ImportProjectedOperation = 'create' \| 'update' \| 'noop' \| 'blocked' \| 'unresolved' \| 'completed'/)
  assert.match(preview, /export function projectImportRowOperation/)
  assert.match(preview, /row\.status === 'unresolved'[\s\S]*operation: 'unresolved'/)
  assert.match(preview, /!applicableStatuses\.has\(row\.status\)[\s\S]*operation: 'blocked'/)
  assert.match(preview, /row\.target_operation === 'update' \|\| row\.target_operation === 'noop'/)
  assert.match(preview, /operation: row\.target_operation as 'create' \| 'update' \| 'noop'/)
})

test('preview counters derive from projected operations without overlap', () => {
  assert.match(preview, /const rows = sourceRows\.map\(projectImportRowOperation\)/)
  assert.match(preview, /const blockedRows = count\('blocked'\)/)
  assert.match(preview, /const unresolvedRows = count\('unresolved'\)/)
  assert.match(preview, /canApply: rows\.length > 0 && completedRows === 0 && blockedRows === 0 && unresolvedRows === 0/)
})

test('administrative preview exposes operation and reason for every row', () => {
  assert.match(panel, /aria-label="Operación prevista por fila"/)
  assert.match(panel, /operationLabels\[row\.operation\]/)
  assert.match(panel, /row\.reason/)
  assert.match(panel, /preview\.unresolvedRows/)
})
