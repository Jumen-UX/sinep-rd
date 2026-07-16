import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = 'supabase/migrations/20260714051000_user_onboarding_contract.sql'
const routePath = 'src/app/(admin)/admin/onboarding/page.tsx'
const pagePath = 'src/features/access/admin/AdminOnboardingPage.tsx'
const passwordInputPath = 'src/features/access/components/PasswordInput.tsx'
const passwordPanelPath = 'src/features/access/components/PasswordSecurityPanel.tsx'
const passwordPolicyPath = 'src/features/access/services/password-policy.ts'
const servicePath = 'src/features/access/services/authentication-admin-service.ts'
const middlewarePath = 'src/middleware.ts'
const policyPath = 'src/lib/admin/accessPolicy.ts'
const invitePath = 'src/app/api/admin/users/create-invite/route.ts'

test('onboarding state is durable, scoped to the authenticated user and audited', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /onboarding_step text not null default 'profile'/)
  assert.match(sql, /onboarding_completed_at timestamptz/)
  assert.match(sql, /v_user_id uuid := auth\.uid\(\)/)
  assert.match(sql, /where id = v_user_id/)
  assert.match(sql, /not v_has_role/)
  assert.match(sql, /users\.complete_onboarding/)
  assert.match(sql, /status = case when v_complete and status = 'pending_invitation' then 'active'/)
  assert.match(sql, /revoke all on function app_private\.save_my_onboarding\(jsonb\) from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.save_my_onboarding\(jsonb\) to authenticated, service_role/)
})

test('first access route delegates UI and I/O to the access feature', async () => {
  const [route, page, service, passwordInput, passwordPanel, passwordPolicy] = await Promise.all([
    readFile(routePath, 'utf8'),
    readFile(pagePath, 'utf8'),
    readFile(servicePath, 'utf8'),
    readFile(passwordInputPath, 'utf8'),
    readFile(passwordPanelPath, 'utf8'),
    readFile(passwordPolicyPath, 'utf8'),
  ])

  assert.match(route, /AdminOnboardingPage as default/)
  assert.match(route, /from '@\/features\/access'/)
  assert.match(page, /loadAdminOnboardingContext/)
  assert.match(page, /saveAdminOnboarding/)
  assert.doesNotMatch(page, /\.rpc\s*\(/)
  assert.match(service, /get_my_onboarding_context/)
  assert.match(service, /save_my_onboarding/)
  assert.match(service, /auth\.updateUser\(\{ password: input\.password \}\)/)
  assert.match(page, /profile_status === 'pending_invitation'/)
  assert.match(page, /getPasswordValidationError/)
  assert.match(page, /passwordEvaluation\.isAcceptable/)
  assert.match(page, /PasswordInput/)
  assert.match(page, /PasswordSecurityPanel/)
  assert.match(passwordInput, /aria-pressed=\{visible\}/)
  assert.match(passwordInput, /type=\{visible \? 'text' : 'password'\}/)
  assert.match(passwordPanel, /Seguridad de la contraseña/)
  assert.match(passwordPanel, /Cumplido/)
  assert.match(passwordPanel, /Pendiente/)
  assert.match(passwordPolicy, /PASSWORD_MIN_LENGTH = 12/)
  assert.match(page, /no puedes asignarte permisos ni elegir un ámbito/)
})

test('login, invitations and middleware resume incomplete onboarding', async () => {
  const [service, middleware, policy, invite] = await Promise.all([
    readFile(servicePath, 'utf8'),
    readFile(middlewarePath, 'utf8'),
    readFile(policyPath, 'utf8'),
    readFile(invitePath, 'utf8'),
  ])

  assert.match(service, /resolveAdminRouteDecision/)
  assert.match(invite, /new URL\('\/admin\/onboarding'/)
  assert.match(middleware, /ADMIN_ONBOARDING_PATH = '\/admin\/onboarding'/)
  assert.match(middleware, /get_my_admin_entry_context/)
  assert.match(middleware, /resolveAdminRouteDecision/)
  assert.match(policy, /accessState === 'onboarding'/)
  assert.match(policy, /destination: '\/admin\/onboarding'/)
})
