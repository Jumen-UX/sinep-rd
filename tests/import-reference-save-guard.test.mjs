import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const editorPath = new URL('../src/features/importaciones/admin/ImportRowFieldEditor.tsx', import.meta.url)
const detailPath = new URL('../src/features/importaciones/admin/ImportBatchDetailPage.tsx', import.meta.url)

test('row corrections cannot be saved while canonical references remain unresolved', async () => {
  const editor = await readFile(editorPath, 'utf8')
  const detail = await readFile(detailPath, 'utf8')

  assert.match(editor, /export type ImportReferenceResolution/)
  assert.match(editor, /onResolutionChange\?\(referenceState\)/)
  assert.match(detail, /referenceStates/)
  assert.match(detail, /state === 'loading' \|\| state === 'error' \|\| state === 'provisional'/)
  assert.match(detail, /disabled=\{isSaving \|\| unresolvedReferenceFields\.length > 0\}/)
  assert.match(detail, /Selecciona referencias canónicas antes de guardar/)
})
