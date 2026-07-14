import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sqlPath = 'supabase/diagnostics/sprint2_structural_parity.sql'

async function readSql() {
  return readFile(sqlPath, 'utf8')
}

test('structural parity diagnostics cover canonical territorial invariants', async () => {
  const sql = await readSql()

  assert.match(sql, /structure_templates/i)
  assert.match(sql, /structure_nodes/i)
  assert.match(sql, /structure_node_edges/i)
  assert.match(sql, /templates_without_root/i)
  assert.match(sql, /nodes_with_multiple_current_parents/i)
  assert.match(sql, /cross_template_current_edges/i)
  assert.match(sql, /linked_ecclesiastical_entity_id/i)
})

test('structural parity diagnostics cover organization and appointment invariants', async () => {
  const sql = await readSql()

  assert.match(sql, /organization_charts/i)
  assert.match(sql, /organization_units/i)
  assert.match(sql, /organization_units_without_active_chart/i)
  assert.match(sql, /cross_chart_parent_units/i)
  assert.match(sql, /position_assignments/i)
  assert.match(sql, /office_configurations/i)
})

test('structural parity diagnostics remain read-only', async () => {
  const sql = await readSql()

  assert.doesNotMatch(sql, /\b(insert|update|delete|alter|drop|truncate|create\s+(table|view|function|policy|trigger))\b/i)
})
