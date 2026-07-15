import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = 'supabase/migrations/20260714052000_admin_entry_access_contract.sql'
const middlewarePath = 'src/middleware.ts'
const policyPath = 'src/lib/admin/accessPolicy.ts'
const authorizationPath = 'src/lib/admin/authorization.ts'
const servicePath = 'src/features/access/services/authentication-admin-service.ts'
const routePath = 'src/app/(admin)/admin/acceso/page.tsx'
const pagePath = 'src/features/access/admin/AdminAccessStatusPage.tsx'

test('administrative entry state is resolved by one authenticated database contract', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  assert.match(sql, /v_user_id uuid := auth\.uid\(\)/)
  assert.match(sql, /v_profile\.status in \('suspended', 'inactive'\) then 'blocked'/)
  assert.match(sql, /v_profile\.onboarding_completed_at is null then 'onboarding'/)
  assert.match(sql, /not v_has_admin_role then 'no_role'/)
  assert.match(sql, /else 'ready'/)
  assert.match(sql, /revoke all on function app_private\.get_my_admin_entry_context\(\) from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.get_my_admin_entry_context\(\) to authenticated, service_role/)
})

test('middleware and APIs fail closed for every state except ready', async () => {
  const [middleware, policy, authorization] = await Promise.all([
    readFile(middlewarePath, 'utf8'),
    readFile(policyPath, 'utf8'),
    readFile(authorizationPath, 'utf8'),
  ])
  assert.match(middleware, /get_my_admin_entry_context/)
  assert.match(middleware, /resolveAdminRouteDecision/)
  assert.match(middleware, /redirectToAccessStatus/)
  assert.doesNotMatch(middleware, /from\('user_role_assignments'\)/)
  assert.match(policy, /accessState !== 'ready'/)
  assert.match(policy, /destination: '\/admin\/acceso'/)
  assert.match(authorization, /get_my_admin_entry_context/)
  assert.match(authorization, /entryContext\?\.access_state !== 'ready'/)
})

test('users without access remain in a dedicated feature route', async () => {
  const [route, page, service] = await Promise.all([
    readFile(routePath, 'utf8'),
    readFile(pagePath, 'utf8'),
    readFile(servicePath, 'utf8'),
  ])
  assert.match(route, /AdminAccessStatusPage as default/)
  assert.match(page, /loadAdminEntryContext/)
  assert.match(page, /signOutAdmin/)
  assert.match(page, /access_state === 'blocked'/)
  assert.doesNotMatch(page, /\.rpc\s*\(/)
  assert.match(service, /get_my_admin_entry_context/)
})

test('next accepts only non-control local administrative paths', async () => {
  const service = await readFile(servicePath, 'utf8')
  assert.match(service, /!next\.startsWith\('\/admin'\)/)
  assert.match(service, /next\.startsWith\('\/\/'\)/)
  assert.match(service, /next\.includes\('\\\\'\)/)
  assert.match(service, /reservedPaths/)
  assert.match(service, /parsed\.origin !== base/)
})
