import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('historical jurisdiction events require source and publish a public event record', async () => {
  const sql = await readRepoFile('supabase/migrations/20260809183000_add_jurisdiction_historical_event_rpc.sql')

  assert.match(sql, /admin_preview_jurisdiction_historical_event/i)
  assert.match(sql, /admin_apply_jurisdiction_historical_event/i)
  assert.match(sql, /Todo acontecimiento histórico requiere una fuente documental/i)
  assert.match(sql, /'historical_event','applied','published'/i)
  assert.match(sql, /public_title,public_summary,source_document_id/i)
  assert.match(sql, /'jurisdiction\.historical_event'/i)
})

test('historical structural events reuse the safe structural RPCs atomically', async () => {
  const sql = await readRepoFile('supabase/migrations/20260809183000_add_jurisdiction_historical_event_rpc.sql')

  assert.match(sql, /admin_apply_jurisdiction_creation/i)
  assert.match(sql, /admin_apply_jurisdiction_dependency_change/i)
  assert.match(sql, /admin_apply_jurisdiction_suppression/i)
  assert.match(sql, /admin_apply_jurisdiction_restoration/i)
  assert.match(sql, /external_reference/i)
  assert.match(sql, /structural_operation_id/i)
  assert.match(sql, /when 'creation' then 'erection'/i)
  assert.match(sql, /when 'dependency_change' then 'dependency_change'/i)
  assert.match(sql, /when 'suppression' then 'suppression'/i)
  assert.match(sql, /when 'restoration' then 'restoration'/i)
})

test('historical event RPCs are authenticated-only', async () => {
  const sql = await readRepoFile('supabase/migrations/20260809183000_add_jurisdiction_historical_event_rpc.sql')

  assert.match(sql, /security definer/i)
  assert.match(sql, /current_user_has_admin_role\(\)/i)
  assert.match(sql, /revoke execute on function public\.admin_preview_jurisdiction_historical_event[^;]*from public,anon/i)
  assert.match(sql, /grant execute on function public\.admin_apply_jurisdiction_historical_event[^;]*to authenticated/i)
})
