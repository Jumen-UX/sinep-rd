import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
  new URL('../supabase/migrations/20260714041000_enable_person_import_noop_by_internal_reference.sql', import.meta.url),
  'utf8',
)

test('person imports can promote one stable internal reference match to noop', () => {
  assert.match(migration, /promote_person_reference_matches_to_noop/)
  assert.match(migration, /normalized_data->>'codigo_referencia'/)
  assert.match(migration, /p\.internal_reference_code/)
  assert.match(migration, /v_match_count=1 and v_target_id is not null/)
  assert.match(migration, /target_operation='noop'/)
  assert.match(migration, /exact_internal_reference_match/)
  assert.match(migration, /matched_person_id/)
})

test('ambiguous person references remain blocking instead of choosing a person', () => {
  assert.match(migration, /v_match_count>1/)
  assert.match(migration, /ambiguous_person_reference/)
  assert.match(migration, /issue_type in \('duplicate','warning'\)/)
  assert.match(migration, /'duplicate','ambiguous_person_reference','codigo_referencia'/)
})

test('canonical validation promotes person references after person-domain validation', () => {
  assert.match(migration, /perform app_private\.finalize_person_import_validation\(p_batch_id\)/)
  assert.match(migration, /return app_private\.promote_person_reference_matches_to_noop\(p_batch_id\)/)
  assert.match(migration, /revoke all on function app_private\.promote_person_reference_matches_to_noop\(uuid\) from public,anon,authenticated/)
})
