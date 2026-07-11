import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('canonical person registration reviews duplicates before every new identity', async () => {
  const service = await readRepoFile('src/features/personas/shared/services/canonical-person-registration-service.ts')

  assert.match(service, /reviewPotentialDuplicates\('person', payload\)/)
  assert.match(service, /mode === 'new'/)
  assert.match(service, /duplicate_review_confirmed: duplicateMatchCount > 0/)
})

test('entity assistants review duplicates in their hierarchy before saving', async () => {
  const files = [
    'src/app/(admin)/admin/nuevo/parroquia/page.tsx',
    'src/app/(admin)/admin/nuevo/capilla/page.tsx',
    'src/app/(admin)/admin/nuevo/jurisdiccion/page.tsx',
  ]

  for (const file of files) {
    const page = await readRepoFile(file)
    assert.match(page, /reviewPotentialDuplicates\('entity'/)
    assert.match(page, /scope_entity_id: payload\.parent_entity_id/)
    assert.match(page, /duplicate_review_confirmed: duplicateMatchCount > 0/)
  }
})

test('duplicate review uses authenticated APIs and requires an explicit decision', async () => {
  const helper = await readRepoFile('src/lib/admin/duplicateReview.ts')

  assert.match(helper, /\/api\/admin\/duplicados\/personas/)
  assert.match(helper, /\/api\/admin\/duplicados\/entidades/)
  assert.match(helper, /globalThis\.confirm/)
  assert.match(helper, /Creación cancelada/)
})
