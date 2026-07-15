import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = 'supabase/migrations/20260714173500_read_structure_tree_from_current_edges.sql'

async function readMigration() {
  return readFile(new URL(`../${migrationPath}`, import.meta.url), 'utf8')
}

test('parent_node_id remains a read projection derived from canonical current edges', async () => {
  const sql = await readMigration()

  assert.match(sql, /from public\.structure_node_edges e/i)
  assert.match(sql, /edge\.parent_node_id/i)
  assert.match(sql, /returns table[\s\S]*parent_node_id uuid/i)
  assert.doesNotMatch(sql, /n\.parent_node_id\s+as\s+parent_node_id/i)
  assert.match(sql, /structure_nodes\.parent_node_id is not a hierarchy source/i)
})

test('tree roots and descendants are both resolved from eligible edges', async () => {
  const sql = await readMigration()

  assert.match(sql, /not exists\s*\([\s\S]*root_edge\.child_node_id\s*=\s*n\.id/i)
  assert.match(sql, /join eligible_edges edge on edge\.parent_node_id = parent\.node_id/i)
  assert.match(sql, /join eligible_nodes child on child\.id = edge\.child_node_id/i)
})
