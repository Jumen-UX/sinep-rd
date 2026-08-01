import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('reserved test fixtures are removed from every public registry domain', async () => {
  const migration = await read('supabase/migrations/20260801204100_segregate_public_test_fixtures.sql')

  for (const table of [
    'ecclesiastical_entities',
    'ecclesiastical_places',
    'ecclesial_institutions',
  ]) {
    assert.match(migration, new RegExp(`update public\\.${table}`))
    assert.match(migration, new RegExp(`alter table public\\.${table}`))
  }

  assert.match(migration, /where slug ~\* '\^test-'/)
  assert.match(migration, /set visibility = 'internal'/)
  assert.match(migration, /check \(slug !~\* '\^test-' or visibility <> 'public'\)/)
  assert.match(migration, /Persisten fixtures test-\* en contratos publicos/)
})

test('public views and profile loaders remain visibility constrained', async () => {
  const [entityContract, registryContract, entityLoader, registryLoader] = await Promise.all([
    read('supabase/migrations/20260728134017_create_public_entity_read_contracts.sql'),
    read('supabase/migrations/20260729014012_add_public_ecclesial_registry_profile_views.sql'),
    read('src/lib/public/entity-detail.ts'),
    read('src/lib/public/ecclesial-registry-detail.ts'),
  ])

  assert.match(entityContract, /entity_row\.visibility = 'public'/)
  assert.match(registryContract, /p\.visibility = 'public'/)
  assert.match(registryContract, /i\.visibility = 'public'/)
  assert.match(entityLoader, /visibility: 'eq\.public'/)
  assert.match(registryLoader, /visibility: 'eq\.public'/)
})
