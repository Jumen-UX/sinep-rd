import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('import report is private, lifecycle-aware and includes canonical row outcomes', async () => {
  const route = await read('src/app/api/admin/importaciones/[batchId]/reporte/route.ts')

  assert.match(route, /permissionKey: 'imports\.prepare'/)
  assert.doesNotMatch(route, /batch\.status !== 'applied'/)
  assert.doesNotMatch(route, /El reporte final solo está disponible para lotes aplicados/)
  assert.match(route, /status, review_status/)
  assert.match(route, /import_batch_row_issues/)
  assert.match(route, /import_batch_changes/)
  assert.match(route, /import_batch_reversals/)
  assert.match(route, /operacion_proyectada/)
  assert.match(route, /resultado_aplicado/)
  assert.match(route, /auditoria_id/)
  assert.match(route, /incidencias/)
  assert.match(route, /application_summary/)
  assert.match(route, /file_sha256/)
  assert.match(route, /Content-Disposition/)
  assert.match(route, /Cache-Control': 'private, no-store'/)
})

test('completed application preview exposes the final CSV report', async () => {
  const panel = await read('src/features/importaciones/admin/ImportApplicationPreviewPanel.tsx')

  assert.match(panel, /const batchId = rows\[0\]\?\.batch_id \?\? null/)
  assert.match(panel, /preview\.isCompleted/)
  assert.match(panel, /\/api\/admin\/importaciones\/\$\{batchId\}\/reporte/)
  assert.match(panel, /Descargar reporte final CSV/)
  assert.match(panel, /hash del archivo, resumen de aplicación, operación y objetivo canónico/)
})
