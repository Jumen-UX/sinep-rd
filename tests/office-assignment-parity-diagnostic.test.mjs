import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const diagnosticPath = 'supabase/diagnostics/sprint2_office_assignment_parity.sql'
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('office and assignment parity diagnostic remains complete and read only', async () => {
  const sql = await read(diagnosticPath)

  assert.match(sql, /structure_level_office_configurations/)
  assert.match(sql, /position_assignments/)
  assert.match(sql, /office_chart_mismatches/)
  assert.match(sql, /unit_chart_mismatches/)
  assert.match(sql, /without_scope/)
  assert.match(sql, /organization_chart_families/)
  assert.doesNotMatch(sql, /\b(insert|update|delete|alter|drop|truncate|create)\b/i)
})
