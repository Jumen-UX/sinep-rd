import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('canonical event catalog keeps historical keys and adds institutional classification', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260715210000_classify_canonical_event_catalog.sql',
  )

  assert.match(migration, /add column if not exists institutional_family text/)
  assert.match(migration, /add column if not exists canonical_target text/)
  assert.match(migration, /add column if not exists application_strategy text/)
  assert.match(migration, /when 'erection' then 'creation'/)
  assert.match(migration, /when 'division' then 'division'/)
  assert.match(migration, /when 'union' then 'merger'/)
  assert.match(migration, /when 'dismemberment' then 'dismemberment'/)
  assert.match(migration, /when 'see_transfer' then 'transfer'/)
  assert.match(migration, /when 'suppression' then 'suppression'/)
  assert.match(migration, /when 'province_change' then 'dependency_change'/)
  assert.doesNotMatch(migration, /update\s+public\.canonical_events/i)
  assert.doesNotMatch(migration, /delete\s+from\s+public\.canonical_event_types/i)
})

test('catalog classification limits canonical destinations and requires compensation', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260715210000_classify_canonical_event_catalog.sql',
  )

  assert.match(migration, /canonical_target in \('entity', 'relationship', 'organization_unit'\)/)
  assert.match(migration, /requires_manual_review boolean not null default true/)
  assert.match(migration, /is_compensable boolean not null default true/)
  assert.match(migration, /alter column institutional_family set not null/)
  assert.match(migration, /alter column canonical_target set not null/)
  assert.match(migration, /alter column application_strategy set not null/)
})
