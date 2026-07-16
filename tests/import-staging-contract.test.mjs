import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const stagingMigration = fs.readFileSync('supabase/migrations/20260716050000_consolidate_import_staging_contract.sql', 'utf8')
const validationMigration = fs.readFileSync('supabase/migrations/20260716051500_use_shared_contract_in_import_validation.sql', 'utf8')

test('import staging exposes one domain contract and one normalizer', () => {
  assert.match(stagingMigration, /create or replace function app_private\.import_domain_staging_contract/i)
  assert.match(stagingMigration, /create or replace function app_private\.normalize_import_row_for_domain/i)
  assert.match(stagingMigration, /required_fields/i)
  assert.match(stagingMigration, /relation_fields/i)
  assert.match(stagingMigration, /normalize_import_row_for_domain\(v_import_type, v_row\)/i)
  assert.match(stagingMigration, /normalize_import_row_for_domain\(v_import_type, p_normalized_data\)/i)
})

test('staging normalization is deterministic and domain aware', () => {
  assert.match(stagingMigration, /upper\(v_row->>'pais_iso2'\)/i)
  assert.match(stagingMigration, /lower\(v_row->>'tipo_entidad'\)/i)
  assert.match(stagingMigration, /v_actual in \('true','1','si','sí'\)/i)
  assert.match(stagingMigration, /v_actual in \('false','0','no'\)/i)
  assert.match(stagingMigration, /lower\(v_row->>'tipo_evento'\)/i)
})

test('validator consumes shared required fields and relation mappings', () => {
  assert.match(validationMigration, /jsonb_array_elements_text\([\s\S]*import_domain_staging_contract/i)
  assert.match(validationMigration, /jsonb_each_text\([\s\S]*import_domain_staging_contract/i)
  assert.doesNotMatch(validationMigration, /when 'personas' then array\[/i)
})

test('row status precedence and internal csv boundary remain explicit', () => {
  assert.match(stagingMigration, /create or replace function app_private\.import_row_status_from_open_issues/i)
  assert.match(stagingMigration, /validation_error[\s\S]*then 'error'/i)
  assert.match(stagingMigration, /duplicate[\s\S]*then 'duplicate'/i)
  assert.match(stagingMigration, /unresolved_relation[\s\S]*then 'unresolved'/i)
  assert.match(stagingMigration, /lower\(coalesce\(v_file ->> 'extension', ''\)\) <> 'csv'/i)
  assert.match(stagingMigration, /revoke all on function app_private\.normalize_import_row_for_domain/i)
})
