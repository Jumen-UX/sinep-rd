import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const importRoutes = [
  'src/app/(admin)/admin/importar/page.tsx',
  'src/app/(admin)/admin/importar/lotes/page.tsx',
  'src/app/(admin)/admin/importar/[batchId]/page.tsx',
]

test('import administration routes delegate to the import feature', async () => {
  for (const routeFile of importRoutes) {
    const route = await readFile(routeFile, 'utf8')

    assert.match(route, /from '@\/features\/importaciones'/)
    assert.doesNotMatch(route, /createClient/)
    assert.doesNotMatch(route, /\.from\s*\(/)
    assert.doesNotMatch(route, /\.rpc\s*\(/)
    assert.doesNotMatch(route, /fetch\s*\(/)
  }
})

test('batch import preparation and history use the import service boundary', async () => {
  const preparePage = await readFile('src/features/importaciones/admin/AdminBatchImportPage.tsx', 'utf8')
  const historyPage = await readFile('src/features/importaciones/admin/ImportBatchHistoryPage.tsx', 'utf8')
  const service = await readFile('src/features/importaciones/services/batch-import-admin-service.ts', 'utf8')

  assert.match(preparePage, /prepareImportBatch/)
  assert.match(preparePage, /parseCsvPreview/)
  assert.match(historyPage, /listImportBatches/)
  assert.match(service, /prepareImportBatch/)
  assert.match(service, /listImportBatches/)
})

test('batch correction review and application stay in the import feature', async () => {
  const detailPage = await readFile('src/features/importaciones/admin/ImportBatchDetailPage.tsx', 'utf8')
  const service = await readFile('src/features/importaciones/services/batch-import-admin-service.ts', 'utf8')

  assert.match(detailPage, /getImportBatchDetail/)
  assert.match(detailPage, /updateImportBatchRow/)
  assert.match(detailPage, /revalidateImportBatch/)
  assert.match(detailPage, /reviewImportBatch/)
  assert.match(detailPage, /applyImportBatch/)
  assert.match(service, /getImportBatchDetail/)
  assert.match(service, /updateImportBatchRow/)
  assert.match(service, /revalidateImportBatch/)
  assert.match(service, /reviewImportBatch/)
  assert.match(service, /applyImportBatch/)
})
