import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const previewSource = await readFile(
  new URL('../src/features/importaciones/domain/import-application-preview.ts', import.meta.url),
  'utf8',
)
const previewPanelSource = await readFile(
  new URL('../src/features/importaciones/admin/ImportApplicationPreviewPanel.tsx', import.meta.url),
  'utf8',
)
const detailPageSource = await readFile(
  new URL('../src/features/importaciones/admin/ImportBatchDetailPage.tsx', import.meta.url),
  'utf8',
)

test('import application preview separates create update noop blocked and unresolved rows', () => {
  assert.match(previewSource, /ImportProjectedOperation = 'create' \| 'update' \| 'noop' \| 'blocked' \| 'unresolved' \| 'completed'/)
  assert.match(previewSource, /supportedOperations = new Set\(\['create', 'update', 'noop'\]\)/)
  assert.match(previewSource, /applicableStatuses = new Set\(\['valid', 'warning'\]\)/)
  assert.match(previewSource, /completedStatuses = new Set\(\['applied', 'skipped'\]\)/)
  assert.match(previewSource, /export function projectImportRowOperation/)
  assert.match(previewSource, /row\.status === 'unresolved'/)
  assert.match(previewSource, /operation: 'blocked'/)
  assert.match(previewSource, /operation: 'unresolved'/)
  assert.match(previewSource, /row\.target_operation === 'update' \|\| row\.target_operation === 'noop'/)
  assert.match(previewSource, /canApply: rows\.length > 0 && completedRows === 0 && blockedRows === 0 && unresolvedRows === 0/)
})

test('completed rows are not presented as blocked or re-applicable', () => {
  assert.match(previewSource, /if \(completedStatuses\.has\(row\.status\)\)/)
  assert.match(previewSource, /operation: 'completed'/)
  assert.match(previewSource, /const rows = sourceRows\.map\(projectImportRowOperation\)/)
  assert.match(previewSource, /const completedRows = count\('completed'\)/)
  assert.match(previewSource, /const blockedRows = count\('blocked'\)/)
  assert.match(previewSource, /const unresolvedRows = count\('unresolved'\)/)
  assert.match(previewSource, /const isCompleted = rows\.length > 0 && completedRows === rows\.length/)
  assert.match(previewPanelSource, /Aplicación completada/)
  assert.match(previewPanelSource, /Lote finalizado/)
  assert.match(previewPanelSource, /creaciones, actualizaciones y coincidencias sin cambio/i)
})

test('import application preview exposes target table counts before applying', () => {
  assert.match(previewSource, /targetTables/)
  assert.match(previewSource, /tableCounts\.set/)
  assert.match(previewSource, /right\.count - left\.count/)
})

test('batch detail renders every supported operation before its apply action', () => {
  assert.match(previewPanelSource, /buildImportApplicationPreview\(rows\)/)
  assert.match(previewPanelSource, /Vista previa antes de aplicar/)
  assert.match(previewPanelSource, /Creaciones/)
  assert.match(previewPanelSource, /Actualizaciones/)
  assert.match(previewPanelSource, /Sin cambios/)
  assert.match(previewPanelSource, /Completadas/)
  assert.match(detailPageSource, /<ImportApplicationPreviewPanel rows=\{rows\} serverCanApply=\{detail\.can_apply\} \/>/)
  assert.match(detailPageSource, /Operación prevista/)
  assert.match(detailPageSource, /Tabla objetivo/)
})
