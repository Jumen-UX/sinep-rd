import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPaths = [
  new URL('../supabase/migrations/20260713152219_audit_scope_columns_and_resolver.sql', import.meta.url),
  new URL('../supabase/migrations/20260713152254_enforce_scoped_audit_contracts.sql', import.meta.url),
  new URL('../supabase/migrations/20260713152305_revoke_direct_canonical_table_writes.sql', import.meta.url),
  new URL('../supabase/migrations/20260713152413_normalize_unknown_audit_scope.sql', import.meta.url),
  new URL('../supabase/migrations/20260713153323_finalize_audit_scope_defaults.sql', import.meta.url),
]

async function readSecurityMigrations() {
  const contents = await Promise.all(migrationPaths.map((path) => readFile(path, 'utf8')))
  return contents.join('\n')
}

test('audit records persist jurisdiction and pastoral scope', async () => {
  const sql = await readSecurityMigrations()

  assert.match(sql, /add column if not exists scope_type text/)
  assert.match(sql, /add column if not exists scope_entity_id uuid/)
  assert.match(sql, /add column if not exists diocese_id uuid/)
  assert.match(sql, /resolve_audit_scope/)
  assert.match(sql, /alter column scope_type set default 'unknown'/)
  assert.match(sql, /alter column scope_type set not null/)
})

test('audit writer requires permission and validates entity scope', async () => {
  const sql = await readSecurityMigrations()

  assert.match(sql, /current_user_has_permission\(v_permission_key\)/)
  assert.match(sql, /current_user_can_manage_entity\(v_permission_key, v_scope\.resolved_scope_entity_id\)/)
  assert.match(sql, /La operación de auditoría está fuera de tu alcance/)
  assert.match(sql, /revoke all on function public\.admin_write_audit_log[^;]+from public, anon/s)
})

test('audit reader filters records by the current user jurisdiction', async () => {
  const sql = await readSecurityMigrations()

  assert.match(sql, /current_user_can_manage_entity\('audit\.view', al\.scope_entity_id\)/)
  assert.match(sql, /current_user_has_scope_access\(\s*'pastoral_entity'/)
  assert.match(sql, /current_user_has_scope_access\(\s*'pastoral_area'/)
})

test('critical canonical tables cannot be written directly by authenticated clients', async () => {
  const sql = await readSecurityMigrations()

  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger/)
  for (const table of [
    'public.canonical_events',
    'public.clergy_profiles',
    'public.ecclesiastical_entities',
    'public.position_assignments',
  ]) {
    assert.match(sql, new RegExp(table.replace('.', '\\.'), 'i'))
  }

  assert.match(sql, /drop policy if exists canonical_events_admin_insert/)
  assert.match(sql, /drop policy if exists phase0_clergy_profiles_insert/)
  assert.match(sql, /drop policy if exists phase0_ecclesiastical_entities_insert/)
  assert.match(sql, /drop policy if exists phase0_position_assignments_insert/)
})
