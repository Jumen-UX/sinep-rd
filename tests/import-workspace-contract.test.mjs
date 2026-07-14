import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL('../src/app/(admin)/admin/importar/page.tsx', import.meta.url),
  'utf8',
)

test('import workspace separates required CSV columns from optional template fields', () => {
  assert.match(source, /requiredColumnsByImportType: Record<ImportType, string\[]>/)
  assert.match(source, /personas: \['tipo_persona', 'primer_nombre', 'primer_apellido'\]/)
  assert.match(source, /parroquias: \['pais_iso2', 'diocesis', 'nivel_padre', 'tipo_entidad', 'nombre'\]/)
  assert.match(source, /asignaciones: \['persona', 'cargo', 'entidad', 'fecha_inicio'\]/)
  assert.match(source, /eventos: \['tipo_evento', 'fecha_efectiva', 'entidad', 'descripcion'\]/)
  assert.match(source, /parseCsvPreview\(source, requiredColumnsByImportType\[importType\]\)/)
  assert.match(source, /columns: \['tipo_evento', 'fecha_efectiva', 'entidad', 'descripcion', 'titulo', 'fuente', 'url_fuente'\]/)
})

test('import workspace describes canonical application for every supported domain', () => {
  assert.match(source, /personas, estructuras, asignaciones y eventos pueden aplicarse mediante contratos canónicos/)
  assert.match(source, /aplicar sus operaciones mediante el contrato canónico/)
  assert.match(source, /La preparación no modifica registros canónicos/)
  assert.match(source, /Revisión previa/)
  assert.match(source, /Aplicación manual/)
  assert.doesNotMatch(source, /aplicar sus personas/)
  assert.doesNotMatch(source, /Los lotes de personas aprobados pueden aplicarse/)
  assert.doesNotMatch(source, /El contrato de personas estará disponible/)
})