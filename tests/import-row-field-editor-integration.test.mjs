import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const detailPage = await readFile(
  new URL('../src/features/importaciones/admin/ImportBatchDetailPage.tsx', import.meta.url),
  'utf8',
)

test('batch row corrections use the typed field editor for the active import domain', () => {
  assert.match(detailPage, /ImportRowFieldEditor/)
  assert.match(detailPage, /importType=\{batch\.import_type\}/)
  assert.match(detailPage, /fieldName=\{key\}/)
  assert.match(detailPage, /setDraftValues\(\(current\) => \(\{ \.\.\.current, \[key\]: nextValue \}\)\)/)
  assert.doesNotMatch(detailPage, /<label key=\{key\}>\{key\}<input/)
})
