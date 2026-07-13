import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrationPaths = [
  'supabase/migrations/20260714020000_canonicalize_organization_unit_scope_and_audit.sql',
  'supabase/migrations/20260714021000_remove_legacy_pastoral_model.sql',
  'supabase/migrations/20260714021500_finalize_organization_unit_contracts.sql',
  'supabase/migrations/20260714022000_finalize_organization_unit_security_contracts.sql',
]

const removedScopeName = ['pastoral', 'entity'].join('_')
const removedScopeId = `${removedScopeName}_id`
const removedTableName = ['pastoral', 'entities'].join('_')

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function readMigration(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('organization unit cutover copies scope before removing old references', async () => {
  const [scope, removal] = await Promise.all([
    readMigration(migrationPaths[0]),
    readMigration(migrationPaths[1]),
  ])

  assert.match(
    scope,
    new RegExp(`set organization_unit_id = coalesce\\(organization_unit_id, ${escaped(removedScopeId)}\\)`),
  )
  assert.match(
    scope,
    new RegExp(`scope_type = case when scope_type = '${escaped(removedScopeName)}' then 'organization_unit'`),
  )

  assert.match(removal, new RegExp(`drop column(?: if exists)? ${escaped(removedScopeId)}`))
  assert.match(removal, new RegExp(`drop column(?: if exists)? related_${escaped(removedScopeId)}`))
  assert.match(removal, new RegExp(`drop column(?: if exists)? linked_${escaped(removedScopeId)}`))
  assert.match(removal, new RegExp(`drop table(?: if exists)? public\\.${escaped(removedTableName)}`))
})

test('canonical migrations expose organization unit contracts only', async () => {
  const [scope, contracts, security] = await Promise.all([
    readMigration(migrationPaths[0]),
    readMigration(migrationPaths[2]),
    readMigration(migrationPaths[3]),
  ])
  const combined = `${scope}\n${contracts}\n${security}`

  assert.match(combined, /p_organization_unit_id uuid/)
  assert.match(combined, /resolved_organization_unit_id uuid/)
  assert.match(combined, /linked_organization_unit_id uuid/)
  assert.match(combined, /public_organization_units/)
  assert.match(combined, /current_user_has_scope_access\(\s*'organization_unit'/)
})

test('cutover is explicit and never relies on cascade deletion', async () => {
  const migrations = await Promise.all(migrationPaths.map(readMigration))
  const combined = migrations.join('\n')

  assert.doesNotMatch(combined, /drop\s+(table|column|function|view)[^;]*\bcascade\b/i)
  assert.match(combined, /uq_current_appointment_person_office_unit/)
  assert.match(combined, /user_role_assignments_one_active_scope_idx/)
  assert.match(combined, /position_assignments_current_scope_idx/)
})
