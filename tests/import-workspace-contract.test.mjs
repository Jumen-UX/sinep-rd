import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(
  new URL('../src/app/(admin)/admin/importar/page.tsx', import.meta.url),
  'utf8',
)
const source = await readFile(
  new URL('../src/features/importaciones/admin/AdminBatchImportPage.tsx', import.meta.url),
  'utf8',
)
const contract = await readFile(
  new URL('../src/features/importaciones/contracts/import-batch-contract.ts', import.meta.url),
  'utf8',
)

test('import workspace route delegates to the import feature', () => {
  assert.match(route, /from '@\/features\/importaciones'/)
  assert.doesNotMatch(route, /requiredColumnsByImportType/)
  assert.doesNotMatch(route, /prepareImportBatch/)
})

test('import workspace separates required CSV columns from optional template fields', () => {
  assert.match(source, /getImportDomainContract\(importType\)/)
  assert.match(source, /parseCsvPreview\(source, \[\.\.\.selectedOption\.requiredColumns\]\)/)
  assert.doesNotMatch(source, /requiredColumnsByImportType/)

  assert.match(contract, /personas:[\s\S]*requiredColumns: \['tipo_persona', 'primer_nombre', 'primer_apellido'\]/)
  assert.match(contract, /parroquias:[\s\S]*requiredColumns: \['pais_iso2', 'diocesis', 'nivel_padre', 'tipo_entidad', 'nombre'\]/)
  assert.match(contract, /asignaciones:[\s\S]*requiredColumns: \['persona', 'cargo', 'entidad', 'fecha_inicio'\]/)
  assert.match(contract, /eventos:[\s\S]*requiredColumns: \['tipo_evento', 'fecha_efectiva', 'entidad', 'descripcion'\]/)
  assert.match(contract, /eventos:[\s\S]*columns: \['tipo_evento', 'fecha_efectiva', 'entidad', 'descripcion', 'titulo', 'fuente', 'url_fuente'\]/)
})

test('import workspace describes canonical application for every supported domain', () => {
  assert.match(contract, /IMPORT_BATCH_TYPES = \['personas', 'parroquias', 'asignaciones', 'eventos'\]/)
  assert.match(source, /aplicar sus operaciones mediante el contrato canónico/)
  assert.match(source, /La preparación no modifica registros canónicos/)
  assert.match(source, /Revisión previa/)
  assert.match(source, /Aplicación manual/)
  assert.doesNotMatch(source, /aplicar sus personas/)
  assert.doesNotMatch(source, /Los lotes de personas aprobados pueden aplicarse/)
  assert.doesNotMatch(source, /El contrato de personas estará disponible/)
})
