import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../supabase/migrations/20260808131500_add_jurisdiction_dependency_change_rpcs.sql',
  import.meta.url,
)

async function readMigration() {
  return readFile(migrationUrl, 'utf8')
}

test('jurisdiction dependency changes require preview validation before atomic apply', async () => {
  const sql = await readMigration()

  assert.match(sql, /admin_preview_jurisdiction_dependency_change/i)
  assert.match(sql, /admin_apply_jurisdiction_dependency_change/i)
  assert.match(sql, /current_user_has_admin_role\(\)/i)
  assert.match(sql, /for update/i)
  assert.match(sql, /p_expected_current_edge_id/i)
  assert.match(sql, /La dependencia vigente cambió desde la vista previa/i)
  assert.match(sql, /jurisdiction_account_type_rules/i)
  assert.match(sql, /requires_source/i)
  assert.match(sql, /with recursive descendants/i)
  assert.match(sql, /El cambio produciría un ciclo/i)
})

test('dependency apply preserves the old edge and creates exactly one current successor edge', async () => {
  const sql = await readMigration()

  assert.match(sql, /valid_to = p_effective_date - 1/i)
  assert.match(sql, /is_current = false/i)
  assert.match(sql, /status = 'inactive'/i)
  assert.match(sql, /insert into public\.jurisdiction_account_edges/i)
  assert.match(sql, /true,\s*'active'/i)
  assert.doesNotMatch(sql, /delete from public\.jurisdiction_account_edges/i)
})

test('dependency apply records one organizational operation, effects and audit metadata', async () => {
  const sql = await readMigration()

  assert.match(sql, /'organizational_change'/i)
  assert.match(sql, /jurisdiction_change_operations/i)
  assert.match(sql, /jurisdiction_change_effects/i)
  assert.match(sql, /'close_dependency'/i)
  assert.match(sql, /'create_dependency'/i)
  assert.match(sql, /admin_write_audit_log/i)
  assert.match(sql, /'jurisdiction\.dependency_change'/i)
  assert.match(sql, /'operation_id'/i)
  assert.match(sql, /'before'/i)
  assert.match(sql, /'after'/i)
})

test('dependency RPCs are authenticated-only facades', async () => {
  const sql = await readMigration()

  assert.match(sql, /security definer/i)
  assert.match(sql, /revoke execute on function public\.admin_preview_jurisdiction_dependency_change[^;]*from anon/i)
  assert.match(sql, /grant execute on function public\.admin_preview_jurisdiction_dependency_change[^;]*to authenticated/i)
  assert.match(sql, /revoke execute on function public\.admin_apply_jurisdiction_dependency_change[^;]*from anon/i)
  assert.match(sql, /grant execute on function public\.admin_apply_jurisdiction_dependency_change[^;]*to authenticated/i)
})
