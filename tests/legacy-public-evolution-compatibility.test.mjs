import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('legacy public evolution view keeps its contract over canonical events', async () => {
  const migration = await readRepoFile('supabase/migrations/20260716040000_repoint_legacy_public_evolution_view.sql')

  assert.match(migration, /create or replace view public\.public_entity_evolution_events/i)
  assert.match(migration, /from public\.canonical_events ce/i)
  assert.match(migration, /join public\.canonical_event_types cet/i)
  assert.match(migration, /public\.canonical_event_participants/i)
  assert.match(migration, /where ce\.status = 'applied'/i)
  assert.match(migration, /public\.public_canonical_institutional_timeline/i)
  assert.match(migration, /grant select on public\.public_entity_evolution_events to anon, authenticated/i)
  assert.doesNotMatch(
    migration.split('create or replace view public.public_entity_evolution_events')[1],
    /from public\.entity_evolution_events/i,
  )
})

test('legacy textual names are preserved before retiring the source dependency', async () => {
  const migration = await readRepoFile('supabase/migrations/20260716040000_repoint_legacy_public_evolution_view.sql')

  assert.match(migration, /legacy_from_entity_name/)
  assert.match(migration, /legacy_to_entity_name/)
  assert.match(migration, /legacy_related_entity_name/)
  assert.match(migration, /legacy_entity_evolution_event_id/)
})
