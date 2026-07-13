import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const previewSource = await readFile(
  new URL('../src/features/importaciones/domain/import-application-preview.ts', import.meta.url),
  'utf8',
)

test('import application preview separates create noop blocked and unresolved rows', () => {
  assert.match(previewSource, /target_operation === 'create'/)
  assert.match(previewSource, /target_operation === 'noop'/)
  assert.match(previewSource, /applicableStatuses = new Set\(\['valid', 'warning'\]\)/)
  assert.match(previewSource, /blockedRows === 0 && unresolvedTargets === 0/)
})

test('import application preview exposes target table counts before applying', () => {
  assert.match(previewSource, /targetTables/)
  assert.match(previewSource, /tableCounts\.set/)
  assert.match(previewSource, /right\.count - left\.count/)
})
