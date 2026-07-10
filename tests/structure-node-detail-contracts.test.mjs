import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('node detail RPC returns source offices assignments and history', async () => {
  const sql = await read('supabase/migrations/20260710183357_fix_structure_node_detail_assignment_contract.sql')

  assert.match(sql, /get_structure_node_detail/)
  assert.match(sql, /allowed_offices/)
  assert.match(sql, /current_assignments/)
  assert.match(sql, /assignment_count/)
  assert.match(sql, /source_checked_at/)
  assert.match(sql, /current_user_can_manage_entity\('structures\.manage'/)
  assert.match(sql, /grant execute on function public\.get_structure_node_detail\(uuid\) to authenticated/)
})

test('structure service exposes typed node detail loading', async () => {
  const service = await read('src/features/structures/services/structure-admin-service.ts')
  const types = await read('src/features/structures/types/index.ts')

  assert.match(service, /export async function loadStructureNodeDetail/)
  assert.match(service, /rpc\('get_structure_node_detail'/)
  assert.match(types, /export type StructureNodeDetail/)
})

test('node detail panel remains presentational', async () => {
  const panel = await read('src/features/structures/components/StructureNodeDetailPanel.tsx')
  const exports = await read('src/features/structures/components/index.ts')

  assert.match(panel, /allowed_offices/)
  assert.match(panel, /current_assignments/)
  assert.match(panel, /Respaldo documental/)
  assert.match(panel, /Nombramientos vigentes/)
  assert.doesNotMatch(panel, /createClient|\.rpc\(|\.from\(/)
  assert.match(exports, /StructureNodeDetailPanel/)
})
