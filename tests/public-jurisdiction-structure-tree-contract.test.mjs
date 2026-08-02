import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const initialMigrationUrl = new URL(
  '../supabase/migrations/20260801225000_add_public_jurisdiction_structure_tree.sql',
  import.meta.url,
)
const publicViewMigrationUrl = new URL(
  '../supabase/migrations/20260802025000_replace_public_jurisdiction_structure_rpc_with_view.sql',
  import.meta.url,
)

async function readMigrations() {
  return Promise.all([
    readFile(initialMigrationUrl, 'utf8'),
    readFile(publicViewMigrationUrl, 'utf8'),
  ])
}

test('public jurisdiction structure tree is read-only and publication-safe', async () => {
  const [initialSql, publicViewSql] = await readMigrations()

  assert.match(initialSql, /create or replace function public\.get_public_jurisdiction_structure_tree/i)
  assert.match(initialSql, /security invoker/i)
  assert.match(initialSql, /t\.diocese_id\s*=\s*p_jurisdiction_id/i)
  assert.match(initialSql, /t\.kind_key\s*=\s*'territorial'/i)
  assert.match(initialSql, /t\.visibility\s*=\s*'public'/i)
  assert.match(initialSql, /n\.visibility\s*=\s*'public'/i)
  assert.match(initialSql, /n\.status\s*=\s*'active'/i)
  assert.match(initialSql, /n\.is_current/i)
  assert.match(initialSql, /n\.start_date\s*<=\s*p_as_of/i)
  assert.match(initialSql, /n\.end_date is null or n\.end_date >= p_as_of/i)
  assert.match(initialSql, /from public\.structure_node_edges/i)
  assert.doesNotMatch(initialSql, /n\.parent_node_id\s*=/i)

  assert.match(publicViewSql, /create view public\.public_jurisdiction_structure_tree/i)
  assert.match(publicViewSql, /security_invoker\s*=\s*true/i)
  assert.match(publicViewSql, /revoke execute[^;]*from anon/i)
  assert.match(publicViewSql, /grant execute[^;]*to authenticated/i)
  assert.match(publicViewSql, /grant select[^;]*to anon, authenticated/i)
  assert.doesNotMatch(publicViewSql, /grant\s+(insert|update|delete)/i)
})
