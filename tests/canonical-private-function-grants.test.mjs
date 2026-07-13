import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../supabase/migrations/20260714022500_harden_canonical_private_function_grants.sql',
  import.meta.url,
)

const protectedFunctions = [
  'app_private.admin_get_change_request_detail',
  'app_private.admin_get_person_detail',
  'app_private.admin_list_people',
  'app_private.admin_list_role_scope_options',
  'app_private.admin_list_roles_with_permissions',
  'app_private.admin_list_users',
  'app_private.current_user_can',
  'app_private.current_user_has_scope_access',
  'app_private.handle_new_auth_user_profile',
  'app_private.resolve_audit_scope',
  'app_private.rpc_definer__admin_get_change_request_detail',
  'internal.list_assignment_canonical_incompatibilities',
]

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('canonical private and internal functions revoke anonymous execution', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  for (const functionName of protectedFunctions) {
    assert.match(
      sql,
      new RegExp(`revoke all on function ${escaped(functionName)}\\([^;]+from public, anon`, 'i'),
      `Falta retirar PUBLIC/anon de ${functionName}`,
    )
  }
})

test('authenticated execution is granted only to application entry helpers', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  for (const functionName of [
    'app_private.admin_get_person_detail',
    'app_private.admin_list_people',
    'app_private.admin_list_role_scope_options',
    'app_private.admin_list_roles_with_permissions',
    'app_private.admin_list_users',
    'app_private.current_user_can',
    'app_private.current_user_has_scope_access',
    'app_private.rpc_definer__admin_get_change_request_detail',
    'internal.list_assignment_canonical_incompatibilities',
  ]) {
    assert.match(
      sql,
      new RegExp(`grant execute on function ${escaped(functionName)}\\([^;]+to authenticated, service_role`, 'i'),
      `Falta el grant autenticado explícito de ${functionName}`,
    )
  }

  assert.match(
    sql,
    /revoke all on function app_private\.handle_new_auth_user_profile\(\) from public, anon, authenticated;/i,
  )
  assert.match(
    sql,
    /revoke all on function app_private\.resolve_audit_scope\([^;]+from public, anon, authenticated;/i,
  )
})
