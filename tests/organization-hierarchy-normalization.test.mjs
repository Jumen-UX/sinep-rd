import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath = 'supabase/migrations/20260714224500_normalize_remaining_diocesan_pastoral_hierarchies.sql'
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('remaining diocesan pastoral hierarchies normalize without approval or publication', async () => {
  const migration = await read(migrationPath)

  assert.match(migration, /oc\.key = 'diocesan_pastoral'/)
  assert.match(migration, /oc\.status = 'active'/)
  assert.match(migration, /having count\(\*\) filter \(where ou\.parent_unit_id is null and ou\.pastoral_area_id is not null\) = 15/)
  assert.match(migration, /count\(\*\) filter \(where ou\.parent_unit_id is null and ou\.pastoral_area_id is null\) = 0/)
  assert.match(migration, /'pastorales-diocesanas-' \|\| v_scope\.entity_slug/)
  assert.match(migration, /ou\.status = 'draft'/)
  assert.match(migration, /ou\.visibility = 'internal'/)
  assert.match(migration, /'internal',\s*\n\s*'draft'/)
  assert.match(migration, /v_normalized_scopes <> 10/)
  assert.match(migration, /v_total_children <> 150/)
  assert.doesNotMatch(migration, /ou\.status\s*=\s*'active'/)
  assert.doesNotMatch(migration, /ou\.visibility\s*=\s*'public'/)
})
