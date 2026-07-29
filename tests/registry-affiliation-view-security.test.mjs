import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrationUrl = new URL(
  'supabase/migrations/20260729210000_set_registry_affiliation_views_security_invoker.sql',
  repoRoot,
)

test('public registry affiliation views execute with caller privileges', async () => {
  const migration = await readFile(migrationUrl, 'utf8')

  assert.match(
    migration,
    /alter view public\.public_ecclesiastical_place_affiliations\s+set \(security_invoker = true\)/,
  )
  assert.match(
    migration,
    /alter view public\.public_ecclesial_institution_affiliations\s+set \(security_invoker = true\)/,
  )
  assert.doesNotMatch(migration, /security_definer/i)
})
