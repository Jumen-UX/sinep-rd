import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration = fs.readFileSync('supabase/migrations/20260716050000_consolidate_import_staging_contract.sql', 'utf8')

test('import staging exposes one domain contract and one normalizer', () => {
  assert.match(migration, /create or replace function app_private\.import_domain_staging_contract/i)
  assert.match(migration, /create or replace function app_private\.normalize_import_row_for_domain/i)
  assert.match(migration, /required_fields/i)
  assert.match(migration, /relation_fields/i)
  assert.match(migration, /normalize_import_row_for_domain\(v_import_type, v_row\)/i)
  assert.match(migration, /normalize_import_row_for_domain\(v_import_type, p_normalized_data\)/i)
})

test('staging normalization is deterministic and domain aware', () => {
  assert.match(migration, /upper\(v_row->>'pais_iso2'\)/i)
  assert.match(migration, /lower\(v_row->>'tipo_entidad'\)/i)
  assert.match(migration, /v_actual in \('true','1','si','sí'\)/i)
  assert.match(migration, /v_actual in \('false','0','no'\)/i)
  assert.match(migration, /lower\(v_row->>'tipo_evento'\)/i)
})

test('row status precedence and internal csv boundary remain explicit', () => {
  assert.match(migration, /create or replace function app_private\.import_row_status_from_open_issues/i)
  assert.match(migration, /validation_error[\s\S]*then 'error'/i)
  assert.match(migration, /duplicate[\s\S]*then 'duplicate'/i)
  assert.match(migration, /unresolved_relation[\s\S]*then 'unresolved'/i)
  assert.match(migration, /lower\(coalesce\(v_file ->> 'extension', ''\)\) <> 'csv'/i)
  assert.match(migration, /revoke all on function app_private\.normalize_import_row_for_domain/i)
})
