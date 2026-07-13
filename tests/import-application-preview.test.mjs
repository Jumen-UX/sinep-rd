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

test('import application preview separates create noop blocked and unresolved rows', () => {
  assert.match(previewSource, /target_operation === 'create'/)
  assert.match(previewSource, /target_operation === 'noop'/)
  assert.match(previewSource, /applicableStatuses = new Set\(\['valid', 'warning'\]\)/)
  assert.match(previewSource, /completedStatuses = new Set\(\['applied', 'skipped'\]\)/)
  assert.match(previewSource, /completedRows === 0 && blockedRows === 0 && unresolvedTargets === 0/)
})

test('completed noop rows are not presented as blocked or re-applicable', () => {
  assert.match(previewSource, /if \(!isApplicable && !isCompleted\) blockedRows \+= 1/)
  assert.match(previewSource, /if \(isCompleted\) completedRows \+= 1/)
  assert.match(previewSource, /const isCompleted = rows\.length > 0 && completedRows === rows\.length/)
  assert.match(previewSource, /canApply: rows\.length > 0 && completedRows === 0/)
  assert.match(previewPanelSource, /Aplicación completada/)
  assert.match(previewPanelSource, /Lote finalizado/)
  assert.match(previewPanelSource, /operaciones sin cambio quedaron registradas y auditadas como omitidas/i)
})

test('import application preview exposes target table counts before applying', () => {
  assert.match(previewSource, /targetTables/)
  assert.match(previewSource, /tableCounts\.set/)
  assert.match(previewSource, /right\.count - left\.count/)
})

test('batch detail renders the application preview before its apply action', () => {
  assert.match(previewPanelSource, /buildImportApplicationPreview\(rows\)/)
  assert.match(previewPanelSource, /Vista previa antes de aplicar/)
  assert.match(previewPanelSource, /Creaciones/)
  assert.match(previewPanelSource, /Sin cambios/)
  assert.match(previewPanelSource, /Completadas/)
  assert.match(detailPageSource, /<ImportApplicationPreviewPanel rows=\{rows\} serverCanApply=\{detail\.can_apply\} \/>/)
  assert.match(detailPageSource, /Operación prevista/)
  assert.match(detailPageSource, /Tabla objetivo/)
})
