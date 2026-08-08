import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = new URL('../supabase/migrations/20260808170000_add_jurisdiction_creation_rpcs.sql', import.meta.url)

async function source() {
  return readFile(migrationPath, 'utf8')
}

test('jurisdiction creation has read-only preview and atomic apply RPCs', async () => {
  const sql = await source()
  assert.match(sql, /admin_preview_jurisdiction_creation/)
  assert.match(sql, /admin_apply_jurisdiction_creation/)
  assert.match(sql, /security definer/i)
  assert.match(sql, /current_user_has_admin_role\(\)/)
})

test('creation validates canonical parent-child rule and source requirements', async () => {
  const sql = await source()
  assert.match(sql, /jurisdiction_account_type_rules/)
  assert.match(sql, /parent_entity_type_id/)
  assert.match(sql, /child_entity_type_id/)
  assert.match(sql, /requires_source/)
  assert.match(sql, /source_document_id/)
})

test('creation does not bind a jurisdiction to a civil country', async () => {
  const sql = await source()
  assert.doesNotMatch(sql, /p_country_iso2/)
  assert.doesNotMatch(sql, /country\s*=/)
  assert.match(sql, /Civil geography is intentionally excluded/)
})

test('creation writes entity, account, dependency, operation effects and audit atomically', async () => {
  const sql = await source()
  assert.match(sql, /insert into public\.ecclesiastical_entities/)
  assert.match(sql, /insert into public\.jurisdiction_accounts/)
  assert.match(sql, /insert into public\.jurisdiction_account_edges/)
  assert.match(sql, /insert into public\.jurisdiction_change_operations/)
  assert.match(sql, /'create_account'/)
  assert.match(sql, /'create_dependency'/)
  assert.match(sql, /admin_write_audit_log/)
  assert.match(sql, /'jurisdiction\.create'/)
})

test('creation RPCs are authenticated-only and cannot create another Holy See root', async () => {
  const sql = await source()
  assert.match(sql, /v_type\.key = 'holy_see'/)
  assert.match(sql, /revoke execute[\s\S]*from public, anon/i)
  assert.match(sql, /grant execute[\s\S]*to authenticated/i)
})
