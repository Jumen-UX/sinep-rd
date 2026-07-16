import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('batch import provides downloadable CSV templates and a bounded preview', async () => {
  const route = await readRepoFile('src/app/(admin)/admin/importar/page.tsx')
  const page = await readRepoFile('src/features/importaciones/admin/AdminBatchImportPage.tsx')
  const parser = await readRepoFile('src/features/importaciones/services/csv-preview.ts')

  assert.match(route, /from '@\/features\/importaciones'/)
  assert.doesNotMatch(route, /buildCsvTemplate/)
  assert.match(page, /buildCsvTemplate/)
  assert.match(page, /parseCsvPreview/)
  assert.match(page, /Descargar plantilla CSV/)
  assert.match(page, /<p className="eyebrow">Vista previa<\/p>/)
  assert.match(page, /preview\.totalRows/)
  assert.match(parser, /rows: dataRows\.slice\(0, limit\)/)
  assert.match(parser, /records,/)
  assert.match(parser, /truncated: dataRows\.length > limit/)
  assert.match(parser, /delimiter,/)
  assert.match(parser, /sha256Hex\(source: ArrayBuffer\)/)
  assert.match(page, /file\.arrayBuffer\(\)/)
})

test('CSV parser handles quoted fields and validates its header', async () => {
  const parser = await readRepoFile('src/features/importaciones/services/csv-preview.ts')

  assert.match(parser, /supportedDelimiters: readonly CsvDelimiter\[\] = \[',', ';', '\\t'\]/)
  assert.match(parser, /quoted && next === '"'/)
  assert.match(parser, /campo entre comillas sin cerrar/)
  assert.match(parser, /columnas duplicadas/)
  assert.match(parser, /missingColumns/)
  assert.match(parser, /extraColumns/)
})