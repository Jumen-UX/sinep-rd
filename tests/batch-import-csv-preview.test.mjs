import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('batch import provides downloadable CSV templates and a bounded preview', async () => {
  const page = await readRepoFile('src/app/(admin)/admin/importar/page.tsx')
  const parser = await readRepoFile('src/features/importaciones/services/csv-preview.ts')

  assert.match(page, /buildCsvTemplate/)
  assert.match(page, /parseCsvPreview/)
  assert.match(page, /Descargar plantilla CSV/)
  assert.match(page, /Vista previa del CSV/)
  assert.match(parser, /normalizedRows\.slice\(0, limit\)/)
  assert.match(parser, /sha256Hex\(source: ArrayBuffer\)/)
  assert.match(page, /file\.arrayBuffer\(\)/)
})

test('CSV parser handles quoted fields and validates its header', async () => {
  const parser = await readRepoFile('src/features/importaciones/services/csv-preview.ts')

  assert.match(parser, /quoted && next === '"'/)
  assert.match(parser, /campo entre comillas sin cerrar/)
  assert.match(parser, /columnas duplicadas/)
  assert.match(parser, /missingColumns/)
})
