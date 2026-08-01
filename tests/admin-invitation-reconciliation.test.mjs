import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routePath = 'src/app/api/admin/users/create-invite/route.ts'
const migrationPath = 'supabase/migrations/20260801223557_make_admin_invitations_recoverable.sql'

test('invitation retries reconcile an existing Auth account instead of creating duplicates', async () => {
  const [route, migration] = await Promise.all([
    readFile(routePath, 'utf8'),
    readFile(migrationPath, 'utf8'),
  ])

  assert.match(route, /inviteUserByEmail/)
  assert.match(route, /admin_reconcile_user_invitation/)
  assert.match(route, /recoverable: inviteCreated/)
  assert.doesNotMatch(route, /\.ilike\('email', email\)/)

  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /from auth\.users auth_user/)
  assert.match(migration, /on conflict \(id\) do update/)
  assert.match(migration, /admin_register_user_country_membership/)
  assert.match(migration, /admin_assign_user_role/)
})

test('invitation reconciliation is permission checked and unavailable to anonymous callers', async () => {
  const migration = await readFile(migrationPath, 'utf8')

  assert.match(migration, /current_user_has_permission\('users\.manage'\)/)
  assert.match(migration, /security invoker/)
  assert.match(
    migration,
    /revoke all on function public\.admin_reconcile_user_invitation\(jsonb\)[\s\S]*?from public, anon/,
  )
  assert.match(
    migration,
    /grant execute on function public\.admin_reconcile_user_invitation\(jsonb\)[\s\S]*?to authenticated/,
  )
})
