import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const requestRoutePath = 'src/app/(admin)/admin/recuperar/solicitar/page.tsx'
const updateRoutePath = 'src/app/(admin)/admin/recuperar/page.tsx'
const requestPagePath = 'src/features/access/admin/RequestPasswordRecoveryPage.tsx'
const updatePagePath = 'src/features/access/admin/UpdateRecoveredPasswordPage.tsx'
const passwordInputPath = 'src/features/access/components/PasswordInput.tsx'
const passwordPanelPath = 'src/features/access/components/PasswordSecurityPanel.tsx'
const passwordPolicyPath = 'src/features/access/services/password-policy.ts'
const passwordStylesPath = 'src/features/access/components/PasswordSecurity.module.css'
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
  assert.match(updatePage, /PasswordInput/)
  assert.match(updatePage, /history\.replaceState/)
  assert.doesNotMatch(updatePage, /auth\.updateUser/)
  assert.match(service, /resetPasswordForEmail/)
  assert.match(service, /PASSWORD_RECOVERY/)
  assert.match(service, /auth\.updateUser\(\{ password \}\)/)
  assert.match(service, /signOut\(\{ scope: 'local' \}\)/)
})

test('password recovery explains and enforces a measurable password policy', async () => {
  const [updatePage, passwordInput, passwordPanel, passwordPolicy, passwordStyles] = await Promise.all([
    readFile(updatePagePath, 'utf8'),
    readFile(passwordInputPath, 'utf8'),
    readFile(passwordPanelPath, 'utf8'),
    readFile(passwordPolicyPath, 'utf8'),
    readFile(passwordStylesPath, 'utf8'),
  ])

  assert.match(passwordPolicy, /PASSWORD_MIN_LENGTH = 12/)
  assert.match(passwordPolicy, /PASSWORD_LONG_PASSPHRASE_LENGTH = 20/)
  assert.match(passwordPolicy, /categoryCount >= 3/)
  assert.match(passwordPolicy, /isAcceptable:/)
  assert.match(updatePage, /disabled=\{!canSubmit\}/)
  assert.match(updatePage, /describedBy="password-security-guidance"/)
  assert.match(passwordInput, /type=\{visible \? 'text' : 'password'\}/)
  assert.match(passwordInput, /aria-pressed=\{visible\}/)
  assert.match(passwordInput, /Mostrar/)
  assert.match(passwordInput, /Ocultar/)
  assert.match(passwordPanel, /role="progressbar"/)
  assert.match(passwordPanel, /aria-live="polite"/)
  assert.match(passwordPanel, /Cumplido/)
  assert.match(passwordPanel, /Pendiente/)
  assert.match(passwordPanel, /12 caracteres como mínimo/)
  assert.match(passwordPanel, /La confirmación coincide/)
  assert.match(passwordPanel, /Minúsculas/)
  assert.match(passwordPanel, /Mayúsculas/)
  assert.match(passwordPanel, /Números/)
  assert.match(passwordPanel, /Símbolos/)
  assert.match(passwordStyles, /data-valid='true'/)
  assert.match(passwordStyles, /visibilityToggle/)
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
