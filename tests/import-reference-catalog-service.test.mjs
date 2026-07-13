import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const servicePath = new URL('../src/features/importaciones/services/import-reference-catalog-service.ts', import.meta.url)
const editorPath = new URL('../src/features/importaciones/admin/ImportRowFieldEditor.tsx', import.meta.url)

test('import reference selectors load canonical scoped catalogs with shared caching', async () => {
  const service = await readFile(servicePath, 'utf8')
  const editor = await readFile(editorPath, 'utf8')

  assert.match(service, /const cache = new Map<ImportReferenceType, Promise<SearchableSelectOption\[\]>>\(\)/)
  assert.match(service, /\.from\('persons'\)/)
  assert.match(service, /\.from\('ecclesiastical_entities'\)/)
  assert.match(service, /\.from\('public_canonical_office_definitions'\)/)
  assert.match(service, /\.from\('canonical_event_types'\)/)
  assert.match(service, /\.eq\('status', 'active'\)/)
  assert.match(service, /\.eq\('is_active', true\)/)
  assert.match(editor, /getImportReferenceOptions\(contract\.referenceType\)/)
  assert.match(editor, /const availableOptions = referenceOptions \?\? catalogOptions/)
  assert.match(editor, /options=\{availableOptions\}/)
  assert.match(editor, /allowCustomValue/)
})
