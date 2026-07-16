import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration = fs.readFileSync('supabase/migrations/20260716053000_unify_import_match_classification.sql', 'utf8')

test('import matches use one explicit three-state contract', () => {
  assert.match(migration, /create or replace function app_private\.classify_import_match_candidates/i)
  assert.match(migration, /when 0 then 'not_found'/i)
  assert.match(migration, /when 1 then 'exact'/i)
  assert.match(migration, /else 'ambiguous'/i)
  assert.match(migration, /candidate_ids/i)
  assert.match(migration, /selected_id/i)
})

test('only one candidate can be selected automatically', () => {
  assert.match(migration, /case when cardinality\(ids\) = 1 then to_jsonb\(ids\[1\]\)/i)
  assert.match(migration, /v_match->>'status' = 'exact'/i)
  assert.match(migration, /v_match->>'status' = 'ambiguous'/i)
  assert.match(migration, /target_record_id=null/i)
  assert.match(migration, /requiere selección manual/i)
})

test('person and canonical target noops share the classifier', () => {
  assert.match(migration, /create or replace function app_private\.classify_import_row_target_match/i)
  assert.match(migration, /classify_import_match_candidates\(v_candidates\)/i)
  assert.match(migration, /promote_exact_import_matches_to_noop/i)
  assert.match(migration, /promote_person_reference_matches_to_noop/i)
  assert.match(migration, /match_contract','not_found\|exact\|ambiguous'/i)
})

test('matching helpers remain private', () => {
  assert.match(migration, /revoke all on function app_private\.classify_import_match_candidates\(uuid\[\]\) from public,anon,authenticated/i)
  assert.match(migration, /revoke all on function app_private\.import_reference_match\(text,text\) from public,anon,authenticated/i)
  assert.match(migration, /revoke all on function app_private\.classify_import_row_target_match\(text,jsonb,jsonb\) from public,anon,authenticated/i)
})
