import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath = 'supabase/migrations/20260714223000_normalize_santiago_diocesan_pastoral_hierarchy.sql'
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Santiago pastoral hierarchy pilot is scoped, idempotent and remains in draft', async () => {
  const migration = await read(migrationPath)

  assert.match(migration, /arquidiocesis-metropolitana-de-santiago-de-los-caballeros/)
  assert.match(migration, /oc\.key = 'diocesan_pastoral'/)
  assert.match(migration, /oc\.status = 'active'/)
  assert.match(migration, /select ou\.id into v_header_id/)
  assert.match(migration, /if v_header_id is null then/)
  assert.match(migration, /pastoral_area_id is not null/)
  assert.match(migration, /ou\.status = 'draft'/)
  assert.match(migration, /ou\.visibility = 'internal'/)
  assert.match(migration, /ou\.is_current = true/)
  assert.match(migration, /'internal',\s*\n\s*'draft'/)
  assert.match(migration, /v_child_count <> 15/)
  assert.doesNotMatch(migration, /ou\.status\s*=\s*'active'/)
  assert.doesNotMatch(migration, /ou\.visibility\s*=\s*'public'/)
})
