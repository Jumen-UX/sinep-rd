import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('batch import domains templates formats and limits share one contract', async () => {
  const contract = await readRepoFile('src/features/importaciones/contracts/import-batch-contract.ts')
  const page = await readRepoFile('src/features/importaciones/admin/AdminBatchImportPage.tsx')
  const route = await readRepoFile('src/app/api/admin/importaciones/preparar/route.ts')

  assert.match(contract, /IMPORT_BATCH_TYPES/)
  assert.match(contract, /IMPORT_FILE_EXTENSIONS/)
  assert.match(contract, /PROCESSABLE_IMPORT_FILE_EXTENSIONS/)
  assert.match(contract, /IMPORT_BATCH_LIMITS/)
  assert.match(contract, /IMPORT_TEMPLATE_VERSION/)
  assert.match(contract, /IMPORT_DOMAIN_CONTRACTS/)
  assert.match(contract, /requiredColumns/)

  assert.match(page, /IMPORT_DOMAIN_OPTIONS/)
  assert.match(page, /IMPORT_BATCH_LIMITS\.maxRows/)
  assert.match(page, /IMPORT_BATCH_LIMITS\.maxFileSizeBytes/)
  assert.match(page, /IMPORT_TEMPLATE_VERSION/)
  assert.doesNotMatch(page, /const importOptions/)
  assert.doesNotMatch(page, /requiredColumnsByImportType/)

  assert.match(route, /isImportBatchType/)
  assert.match(route, /isProcessableImportFileExtension/)
  assert.match(route, /Actualmente solo se pueden preparar archivos CSV UTF-8/)
  assert.match(route, /IMPORT_BATCH_LIMITS\.maxRows/)
  assert.match(route, /IMPORT_BATCH_LIMITS\.maxFileSizeBytes/)
  assert.match(route, /IMPORT_TEMPLATE_VERSION/)
  assert.doesNotMatch(route, /allowedImportTypes/)
  assert.doesNotMatch(route, /allowedExtensions/)
})
