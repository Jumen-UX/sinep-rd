import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const diagnosticPath = 'supabase/diagnostics/sprint2_organization_unit_approval_readiness.sql'
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('organization approval readiness diagnostic remains complete and read only', async () => {
  const sql = await read(diagnosticPath)

  assert.match(sql, /organization_charts/)
  assert.match(sql, /organization_units/)
  assert.match(sql, /diocesan_pastoral/)
  assert.match(sql, /ready_for_functional_review/)
  assert.match(sql, /requires_hierarchy_normalization/)
  assert.match(sql, /header_candidates/)
  assert.match(sql, /pastoral_area_units/)
  assert.match(sql, /scope_entities_ready_for_review/)
  assert.match(sql, /scope_entities_requiring_hierarchy_normalization/)

  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|alter|drop|create\s+(table|function|view))\b/i)
})
