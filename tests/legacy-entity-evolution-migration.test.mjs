import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readMigration() {
  return readFile(
    new URL('supabase/migrations/20260715214500_migrate_legacy_entity_evolution_events.sql', repoRoot),
    'utf8',
  )
}

test('legacy entity evolution events migrate idempotently into canonical review', async () => {
  const migration = await readMigration()

  assert.match(migration, /legacy_entity_evolution_event_id/)
  assert.match(migration, /status[\s\S]*'pending_review'/)
  assert.match(migration, /load_mode[\s\S]*'carga_historica'/)
  assert.match(migration, /'erection_by_dismemberment' then 'erection'/)
  assert.match(migration, /'territory_loss' then 'boundary_change'/)
  assert.match(migration, /migration_review_required', true/)
  assert.doesNotMatch(migration, /'approved'/)
  assert.doesNotMatch(migration, /applied_at\s*=/)
})

test('legacy participants preserve origin, destination and related entities', async () => {
  const migration = await readMigration()

  assert.match(migration, /canonical_event_participants/)
  assert.match(migration, /'origin_entity'/)
  assert.match(migration, /'destination_entity'/)
  assert.match(migration, /'source_entity'/)
  assert.match(migration, /'created_entity'/)
  assert.match(migration, /'affected_jurisdiction'/)
})
