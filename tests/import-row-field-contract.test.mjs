import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const contractSource = await readFile(
  new URL('../src/features/importaciones/domain/import-row-field-contract.ts', import.meta.url),
  'utf8',
)

const editorSource = await readFile(
  new URL('../src/features/importaciones/admin/ImportRowFieldEditor.tsx', import.meta.url),
  'utf8',
)

test('import row field contract uses typed controls for canonical values', () => {
  assert.match(contractSource, /fecha_efectiva: \{ label: 'Fecha efectiva', kind: 'date' \}/)
  assert.match(contractSource, /visibilidad: \{ label: 'Visibilidad', kind: 'select'/)
  assert.match(contractSource, /es_actual:/)
  assert.match(contractSource, /kind: 'boolean'/)
  assert.match(contractSource, /tipo_persona:/)
})

test('import row editor renders select textarea and typed input controls', () => {
  assert.match(editorSource, /contract\.kind === 'select' \|\| contract\.kind === 'boolean'/)
  assert.match(editorSource, /<select/)
  assert.match(editorSource, /<textarea/)
  assert.match(editorSource, /type=\{contract\.kind\}/)
})
