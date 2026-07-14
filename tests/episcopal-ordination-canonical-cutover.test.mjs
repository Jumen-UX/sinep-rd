import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
  new URL('../supabase/migrations/20260714051000_remove_duplicate_episcopal_ordinations.sql', import.meta.url),
  'utf8',
)

test('episcopal succession is projected from canonical ordination events', () => {
  assert.match(migration, /create view public\.public_episcopal_ordinations/i)
  assert.match(migration, /from public\.ordination_events oe/i)
  assert.match(migration, /oe\.degree = 'episcopate'/i)
  assert.match(migration, /principal_ordainer_person_id as principal_consecrator_person_id/i)
  assert.match(migration, /assistant_ordainer_1_person_id as co_consecrator_1_person_id/i)
  assert.match(migration, /assistant_ordainer_2_person_id as co_consecrator_2_person_id/i)
  assert.match(migration, /security_invoker = true/i)
})

test('the duplicate episcopal ordination table and active writes are removed explicitly', () => {
  assert.match(migration, /pg_get_functiondef\('internal\.admin_save_bishop\(jsonb\)'::regprocedure\)/i)
  assert.match(migration, /pg_get_functiondef\('internal\.admin_save_canonical_person\(jsonb\)'::regprocedure\)/i)
  assert.match(migration, /drop table public\.episcopal_ordinations;/i)
  assert.doesNotMatch(migration, /drop table public\.episcopal_ordinations cascade/i)
})
