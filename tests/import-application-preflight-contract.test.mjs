import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const preflight = fs.readFileSync('supabase/migrations/20260716060000_add_import_application_preflight.sql', 'utf8')
const noop = fs.readFileSync('supabase/migrations/20260716060500_support_person_noop_application.sql', 'utf8')
const dispatcher = fs.readFileSync('supabase/migrations/20260716061000_route_import_application_from_preflight.sql', 'utf8')

test('application preflight rejects blocked unresolved and inconsistent rows', () => {
  assert.match(preflight, /row_count/i)
  assert.match(preflight, /validation_error','duplicate','unresolved_relation/i)
  assert.match(preflight, /target_operation not in \('create','update','noop'\)/i)
  assert.match(preflight, /target_record_id is null/i)
  assert.match(preflight, /for update/i)
})

test('noop application supports persons and records immutable row outcomes', () => {
  assert.match(noop, /target_table='persons'/i)
  assert.match(noop, /record_import_noop_row/i)
  assert.match(noop, /import_batch_changes/i)
  assert.match(noop, /import\.row\.noop/i)
  assert.match(noop, /status='skipped'/i)
})

test('dispatcher routes only from the validated deterministic projection', () => {
  assert.match(dispatcher, /import_application_preflight/i)
  assert.match(dispatcher, /v_noop=v_total/i)
  assert.match(dispatcher, /v_update=v_total and v_type='eventos'/i)
  assert.match(dispatcher, /v_create>0 and v_noop>0/i)
  assert.match(dispatcher, /combinación de operaciones todavía no soportada/i)
})
