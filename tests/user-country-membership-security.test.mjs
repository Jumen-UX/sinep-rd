import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const membershipMigration = '20260727214448_user_country_memberships.sql'
const denyMigration = '20260727215540_deny_direct_user_country_membership_access.sql'

test('country membership migrations match the applied Supabase history', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))

  assert.equal(files.includes(membershipMigration), true)
  assert.equal(files.includes(denyMigration), true)
})

test('membership tables stay internal and use explicit deny-all RLS policies', async () => {
  const [membershipSource, denySource] = await Promise.all([
    readFile(new URL(`supabase/migrations/${membershipMigration}`, repoRoot), 'utf8'),
    readFile(new URL(`supabase/migrations/${denyMigration}`, repoRoot), 'utf8'),
  ])

  assert.match(membershipSource, /create table if not exists app_private\.user_country_memberships/)
  assert.match(membershipSource, /create table if not exists app_private\.user_country_membership_sources/)
  assert.match(membershipSource, /enable row level security/)
  assert.match(membershipSource, /revoke all on table app_private\.user_country_memberships from public, anon, authenticated/)
  assert.match(membershipSource, /revoke all on table app_private\.user_country_membership_sources from public, anon, authenticated/)

  assert.match(denySource, /create policy user_country_memberships_internal_only/)
  assert.match(denySource, /create policy user_country_membership_sources_internal_only/)
  assert.equal((denySource.match(/as restrictive/g) ?? []).length, 2)
  assert.equal((denySource.match(/using \(false\)/g) ?? []).length, 2)
  assert.equal((denySource.match(/with check \(false\)/g) ?? []).length, 2)
})

test('invitation membership is persisted before optional role assignment', async () => {
  const [routeSource, reconciliationSource] = await Promise.all([
    readFile(new URL('src/app/api/admin/users/create-invite/route.ts', repoRoot), 'utf8'),
    readFile(
      new URL('supabase/migrations/20260801223557_make_admin_invitations_recoverable.sql', repoRoot),
      'utf8',
    ),
  ])

  const membershipPosition = reconciliationSource.indexOf('admin_register_user_country_membership')
  const assignmentPosition = reconciliationSource.indexOf('admin_assign_user_role')

  assert.ok(membershipPosition > 0)
  assert.ok(assignmentPosition > membershipPosition)
  assert.match(routeSource, /admin_reconcile_user_invitation/)
  assert.match(routeSource, /validate_admin_country_scope/)
  assert.match(routeSource, /validatedAccess\.country_iso2 !== validatedCountry\.country_iso2/)
})
