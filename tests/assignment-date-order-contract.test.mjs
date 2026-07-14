import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
  new URL('../supabase/migrations/20260714042000_prevent_negative_assignment_intervals.sql', import.meta.url),
  'utf8',
)
const validationMigration = await readFile(
  new URL('../supabase/migrations/20260714042500_validate_assignment_date_constraint.sql', import.meta.url),
  'utf8',
)

test('same-day assignment succession never produces a negative interval', () => {
  assert.match(migration, /normalize_position_assignment_date_order/)
  assert.match(migration, /new\.actual_end_date < new\.start_date/)
  assert.match(migration, /new\.actual_end_date := new\.start_date/)
  assert.match(migration, /before insert or update of start_date, actual_end_date/)
})

test('historical negative assignment dates are repaired without hardcoded record ids', () => {
  assert.match(migration, /set actual_end_date = start_date/)
  assert.match(migration, /actual_end_date < start_date/)
  assert.doesNotMatch(migration, /where id\s*=\s*'[0-9a-f-]{36}'/i)
})

test('database validates the canonical assignment date invariant', () => {
  assert.match(migration, /position_assignments_actual_end_not_before_start/)
  assert.match(migration, /actual_end_date >= start_date/)
  assert.match(migration, /not valid/)
  assert.match(validationMigration, /validate constraint position_assignments_actual_end_not_before_start/)
  assert.match(migration, /revoke all on function app_private\.normalize_position_assignment_date_order\(\) from public, anon, authenticated/)
})
