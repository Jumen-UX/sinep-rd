import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('jurisdiction suppression preserves history and cannot orphan current children', async () => {
  const sql = await readRepoFile('supabase/migrations/20260809170000_add_jurisdiction_suppression_restoration_rpcs.sql')

  assert.match(sql, /admin_preview_jurisdiction_suppression/i)
  assert.match(sql, /admin_apply_jurisdiction_suppression/i)
  assert.match(sql, /parent_account_id=p_account_id and is_current and status='active'/i)
  assert.match(sql, /dependencia\(s\) vigente\(s\).*antes de suprimirla/i)
  assert.match(sql, /v_type_key='holy_see'/i)
  assert.match(sql, /valid_to=p_effective_date-1,is_current=false,status='inactive'/i)
  assert.match(sql, /canonical_status='suppressed'/i)
  assert.match(sql, /status='suppressed',suppressed_at=p_effective_date/i)
  assert.match(sql, /'jurisdiction\.suppression'/i)
  assert.match(sql, /'deactivate_account'/i)
  assert.match(sql, /'close_dependency'/i)
})

test('jurisdiction restoration reuses the same account and creates one new current dependency', async () => {
  const sql = await readRepoFile('supabase/migrations/20260809170000_add_jurisdiction_suppression_restoration_rpcs.sql')

  assert.match(sql, /admin_preview_jurisdiction_restoration/i)
  assert.match(sql, /admin_apply_jurisdiction_restoration/i)
  assert.match(sql, /jurisdiction_account_type_rules/i)
  assert.match(sql, /requires_source/i)
  assert.match(sql, /canonical_status='restored'/i)
  assert.match(sql, /valid_to=null,is_current=true,status='active'/i)
  assert.match(sql, /insert into public\.jurisdiction_account_edges/i)
  assert.match(sql, /'activate_account'/i)
  assert.match(sql, /'create_dependency'/i)
  assert.match(sql, /'jurisdiction\.restoration'/i)
  assert.doesNotMatch(sql, /delete from public\.jurisdiction_accounts/i)
  assert.doesNotMatch(sql, /delete from public\.ecclesiastical_entities/i)
})

test('lifecycle RPCs are authenticated-only and administrative changes remain internal', async () => {
  const sql = await readRepoFile('supabase/migrations/20260809170000_add_jurisdiction_suppression_restoration_rpcs.sql')

  assert.match(sql, /origin,status,publication_status/i)
  assert.match(sql, /'organizational_change','applied','internal'/i)
  assert.match(sql, /security definer/i)
  assert.match(sql, /current_user_has_admin_role\(\)/i)
  assert.match(sql, /revoke execute on function public\.admin_preview_jurisdiction_suppression[^;]*from public,anon/i)
  assert.match(sql, /grant execute on function public\.admin_apply_jurisdiction_restoration[^;]*to authenticated/i)
  assert.doesNotMatch(sql, /publication_status[^\n]*'published'/i)
})
