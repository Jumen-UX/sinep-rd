import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
  new URL('../supabase/migrations/20260714043500_align_assignment_office_charts.sql', import.meta.url),
  'utf8',
)

test('position assignments inherit the organization chart configured by their office', () => {
  assert.match(migration, /enforce_position_assignment_office_chart/)
  assert.match(migration, /new\.organization_chart_id := v_office_chart_id/)
  assert.match(migration, /pa\.organization_chart_id is null/)
  assert.match(migration, /oc\.organization_chart_id is not null/)
})

test('position assignments reject an organization chart that conflicts with their office', () => {
  assert.match(migration, /new\.organization_chart_id is distinct from v_office_chart_id/)
  assert.match(migration, /El organigrama del nombramiento no coincide/)
  assert.match(migration, /errcode = '23514'/)
})

test('the chart enforcement helper remains private and trigger-backed', () => {
  assert.match(migration, /revoke all on function app_private\.enforce_position_assignment_office_chart\(\) from public, anon, authenticated/)
  assert.match(migration, /position_assignments_enforce_office_chart/)
  assert.match(migration, /before insert or update of office_configuration_id, organization_chart_id/)
})
