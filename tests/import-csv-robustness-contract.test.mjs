import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('csv parser detects supported delimiters and rejects malformed rows', async () => {
  const parser = await readRepoFile('src/features/importaciones/services/csv-preview.ts')

  assert.match(parser, /supportedDelimiters.*\[',', ';', '\\t'\]/s)
  assert.match(parser, /detectDelimiter/)
  assert.match(parser, /delimitadores ambiguos/)
  assert.match(parser, /caracteres nulos no permitidos/)
  assert.match(parser, /dataRow\.length !== headers\.length/)
  assert.match(parser, /maxCellCharacters/)
  assert.match(parser, /maxColumns/)
})

test('spreadsheet formats remain recognized but not processable', async () => {
  const contract = await readRepoFile('src/features/importaciones/contracts/import-batch-contract.ts')
  const api = await readRepoFile('src/app/api/admin/importaciones/preparar/route.ts')
  const page = await readRepoFile('src/features/importaciones/admin/AdminBatchImportPage.tsx')

  assert.match(contract, /IMPORT_FILE_EXTENSIONS = \['csv', 'xlsx', 'xls'\]/)
  assert.match(contract, /PROCESSABLE_IMPORT_FILE_EXTENSIONS = \['csv'\]/)
  assert.match(api, /isProcessableImportFileExtension/)
  assert.match(api, /solo se pueden preparar archivos CSV UTF-8/)
  assert.match(page, /XLSX y XLS deben exportarse como CSV UTF-8/)
  assert.match(page, /csv_delimiter/)
})
