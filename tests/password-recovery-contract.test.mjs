import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const requestRoutePath = 'src/app/(admin)/admin/recuperar/solicitar/page.tsx'
const updateRoutePath = 'src/app/(admin)/admin/recuperar/page.tsx'
const requestPagePath = 'src/features/access/admin/RequestPasswordRecoveryPage.tsx'
const updatePagePath = 'src/features/access/admin/UpdateRecoveredPasswordPage.tsx'
const passwordPanelPath = 'src/features/access/components/PasswordSecurityPanel.tsx'
const passwordPolicyPath = 'src/features/access/services/password-policy.ts'
const servicePath = 'src/features/access/services/authentication-admin-service.ts'
const middlewarePath = 'src/middleware.ts'
const policyPath = 'src/lib/admin/accessPolicy.ts'
const adminResetPath = 'src/app/api/admin/users/reset-access/route.ts'

test('password recovery routes delegate to the access feature', async () => {
  const [requestRoute, updateRoute] = await Promise.all([
    readFile(requestRoutePath, 'utf8'),
    readFile(updateRoutePath, 'utf8'),
  ])

  assert.match(requestRoute, /RequestPasswordRecoveryPage as default/)
  assert.match(updateRoute, /UpdateRecoveredPasswordPage as default/)
  for (const route of [requestRoute, updateRoute]) {
    assert.match(route, /from '@\/features\/access'/)
    assert.doesNotMatch(route, /createClient|fetch\s*\(|\.auth\./)
  }
})

test('recovery service owns session validation and password mutation', async () => {
  const [requestPage, updatePage, service] = await Promise.all([
    readFile(requestPagePath, 'utf8'),
    readFile(updatePagePath, 'utf8'),
    readFile(servicePath, 'utf8'),
  ])

  assert.match(requestPage, /requestOwnPasswordRecovery/)
  assert.match(requestPage, /Si existe una cuenta habilitada/)
  assert.doesNotMatch(requestPage, /resetPasswordForEmail/)
  assert.match(updatePage, /waitForPasswordRecoverySession/)
  assert.match(updatePage, /updateRecoveredPassword/)
  assert.match(updatePage, /getPasswordValidationError/)
  assert.match(updatePage, /passwordEvaluation\.isAcceptable/)
  assert.match(updatePage, /PasswordSecurityPanel/)
  assert.match(updatePage, /history\.replaceState/)
  assert.doesNotMatch(updatePage, /auth\.updateUser/)
  assert.match(service, /resetPasswordForEmail/)
  assert.match(service, /PASSWORD_RECOVERY/)
  assert.match(service, /auth\.updateUser\(\{ password \}\)/)
  assert.match(service, /signOut\(\{ scope: 'local' \}\)/)
})

test('password recovery explains and enforces a measurable password policy', async () => {
  const [updatePage, passwordPanel, passwordPolicy] = await Promise.all([
    readFile(updatePagePath, 'utf8'),
    readFile(passwordPanelPath, 'utf8'),
    readFile(passwordPolicyPath, 'utf8'),
  ])

  assert.match(passwordPolicy, /PASSWORD_MIN_LENGTH = 12/)
  assert.match(passwordPolicy, /PASSWORD_LONG_PASSPHRASE_LENGTH = 20/)
  assert.match(passwordPolicy, /categoryCount >= 3/)
  assert.match(passwordPolicy, /isAcceptable:/)
  assert.match(updatePage, /disabled=\{!canSubmit\}/)
  assert.match(updatePage, /aria-describedby="password-security-guidance"/)
  assert.match(passwordPanel, /role="progressbar"/)
  assert.match(passwordPanel, /aria-live="polite"/)
  assert.match(passwordPanel, /12 caracteres como mínimo/)
  assert.match(passwordPanel, /La confirmación coincide/)
})

test('recovery links remain reachable before session establishment', async () => {
  const [middleware, policy, adminReset] = await Promise.all([
    readFile(middlewarePath, 'utf8'),
    readFile(policyPath, 'utf8'),
    readFile(adminResetPath, 'utf8'),
  ])

  assert.match(middleware, /ADMIN_RECOVERY_PREFIX = '\/admin\/recuperar'/)
  assert.match(middleware, /resolveAdminRouteDecision/)
  assert.match(policy, /pathname\.startsWith\('\/admin\/recuperar'\)/)
  assert.match(adminReset, /new URL\('\/admin\/recuperar'/)
  assert.doesNotMatch(adminReset, /new URL\('\/admin\/login'/)
})
