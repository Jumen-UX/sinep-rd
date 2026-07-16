import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const reportRoute = readFileSync('src/app/api/admin/importaciones/[batchId]/reporte/route.ts', 'utf8')
const panel = readFileSync('src/features/importaciones/admin/ImportBatchReportAndReversalPanel.tsx', 'utf8')
const route = readFileSync('src/app/(admin)/admin/importar/[batchId]/page.tsx', 'utf8')

test('batch report includes projected, applied, issue, audit and reversal evidence', () => {
  assert.match(reportRoute, /import_batch_row_issues/)
  assert.match(reportRoute, /import_batch_changes/)
  assert.match(reportRoute, /import_batch_reversals/)
  assert.match(reportRoute, /operacion_proyectada/)
  assert.match(reportRoute, /resultado_aplicado/)
  assert.match(reportRoute, /auditoria_id/)
  assert.match(reportRoute, /incidencias/)
  assert.match(reportRoute, /estado_reversion/)
  assert.match(reportRoute, /Cache-Control': 'private, no-store'/)
})

test('applied batch exposes explicit logical reversal with mandatory reason', () => {
  assert.match(panel, /status === 'applied'/)
  assert.match(panel, /reason\.trim\(\)\.length < 10/)
  assert.match(panel, /window\.confirm/)
  assert.match(panel, /reverseImportBatch\(batchId, normalizedReason\)/)
  assert.match(panel, /No se eliminan físicamente/)
  assert.match(panel, /requieren resolución canónica manual/)
})

test('detail route composes canonical detail with report and reversal controls', () => {
  assert.match(route, /ImportBatchDetailPage/)
  assert.match(route, /ImportBatchReportAndReversalPanel/)
  assert.match(route, /batchId=\{batchId\}/)
})
