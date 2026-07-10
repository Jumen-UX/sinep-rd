import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

test('clerical dimension creator foreign keys have covering indexes', async () => {
  const migration = await readFile(
    new URL('supabase/migrations/20260710205017_index_clerical_dimension_creators.sql', repoRoot),
    'utf8',
  )

  for (const index of [
    'clerical_incardinations_created_by_idx',
    'clerical_status_history_created_by_idx',
    'episcopal_roles_created_by_idx',
    'person_ecclesiastical_dignities_created_by_idx',
  ]) {
    assert.match(migration, new RegExp(`create index ${index}`))
  }
})
