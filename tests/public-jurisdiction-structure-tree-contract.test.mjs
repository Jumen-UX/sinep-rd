import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../supabase/migrations/20260801225000_add_public_jurisdiction_structure_tree.sql',
  import.meta.url,
)

async function readMigration() {
  return readFile(migrationUrl, 'utf8')
}

test('public jurisdiction structure tree is read-only and publication-safe', async () => {
  const sql = await readMigration()

  assert.match(sql, /create or replace function public\.get_public_jurisdiction_structure_tree/i)
  assert.match(sql, /security invoker/i)
  assert.match(sql, /t\.diocese_id\s*=\s*p_jurisdiction_id/i)
  assert.match(sql, /t\.kind_key\s*=\s*'territorial'/i)
  assert.match(sql, /t\.visibility\s*=\s*'public'/i)
  assert.match(sql, /n\.visibility\s*=\s*'public'/i)
  assert.match(sql, /n\.status\s*=\s*'active'/i)
  assert.match(sql, /n\.is_current/i)
  assert.match(sql, /n\.start_date\s*<=\s*p_as_of/i)
  assert.match(sql, /n\.end_date is null or n\.end_date >= p_as_of/i)
  assert.match(sql, /structure_node_edges/i)
  assert.doesNotMatch(sql, /structure_nodes\s+[^;]*parent_node_id\s*=/is)
  assert.match(sql, /grant execute[^;]*to anon, authenticated/i)
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)/i)
})
