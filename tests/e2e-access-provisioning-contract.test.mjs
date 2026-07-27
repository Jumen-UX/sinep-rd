import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [provisioner, deprovisioner, packageJson, gitignore] = await Promise.all([
  readFile('scripts/provision-e2e-access-profiles.mjs', 'utf8'),
  readFile('scripts/deprovision-e2e-access-profiles.mjs', 'utf8'),
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('.gitignore', 'utf8'),
])

test('access provisioning uses the official server-side Auth admin API', () => {
  assert.match(provisioner, /createClient.*@supabase\/supabase-js/)
  assert.match(provisioner, /supabase\.auth\.admin\.listUsers/)
  assert.match(provisioner, /supabase\.auth\.admin\.createUser/)
  assert.match(provisioner, /supabase\.auth\.admin\.updateUserById/)
  assert.match(provisioner, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(provisioner, /from\(['"]auth\.users['"]\)/)
  assert.doesNotMatch(provisioner, /insert\s+into\s+auth\.users/i)
})

test('access provisioning fails closed outside an explicitly confirmed QA context', () => {
  assert.match(provisioner, /PROVISION_NON_PRODUCTION_E2E/)
  assert.match(provisioner, /E2E_PROVISION_CONFIRM/)
  assert.match(provisioner, /endsWith\('\.test'\)/)
  assert.match(provisioner, /endsWith\('\.invalid'\)/)
  assert.match(provisioner, /startsWith\('test-'\)/)
  assert.match(provisioner, /Las entidades A y B deben ser distintas/)
})

test('generated credentials remain outside version control and are not printed', () => {
  assert.match(provisioner, /randomBytes\(24\)/)
  assert.match(provisioner, /mode: 0o600/)
  assert.match(provisioner, /chmod\(absolutePath, 0o600\)/)
  assert.match(gitignore, /^\.secrets\/$/m)
  assert.doesNotMatch(provisioner, /console\.log\([^\n]*password/i)
  assert.doesNotMatch(provisioner, /console\.log\([^\n]*JSON\.stringify\(matrix/i)
})

test('provisioned matrix covers every access state and bidirectional roles', () => {
  for (const state of ['ready', 'onboarding', 'no_role', 'blocked']) {
    assert.match(provisioner, new RegExp(`expectedState: '${state}'`))
  }
  assert.match(provisioner, /roleKey: 'diocesan_admin'/)
  assert.match(provisioner, /roleKey: 'internal_viewer'/)
  assert.match(provisioner, /navigationRole: 'administrator'/)
  assert.match(provisioner, /navigationRole: 'viewer'/)
  assert.match(provisioner, /forbiddenEntityId: forbiddenEntity\.id/)
  assert.match(provisioner, /minimumVisibleDioceses: 1/)
})

test('provisioning is idempotent, scoped and audited without persisting passwords', () => {
  assert.match(provisioner, /from\('profiles'\)\.upsert/)
  assert.match(provisioner, /from\('user_role_assignments'\)\.delete\(\)\.eq\('user_id', userId\)/)
  assert.match(provisioner, /scope_type: 'diocese'/)
  assert.match(provisioner, /provision_e2e_access_profile/)
  assert.match(provisioner, /e2e_profile_key: spec\.key/)
  assert.doesNotMatch(provisioner, /new_data:\s*\{[^}]*password/s)
})

test('deprovisioning suspends and removes roles before optional deletion', () => {
  assert.match(deprovisioner, /DEPROVISION_NON_PRODUCTION_E2E/)
  assert.match(deprovisioner, /E2E_DEPROVISION_MODE/)
  assert.match(deprovisioner, /E2E_DELETE_CONFIRM/)
  assert.match(deprovisioner, /DELETE_NON_PRODUCTION_E2E_USERS/)
  assert.match(deprovisioner, /app_metadata\?\.e2e_access_profile === true/)
  assert.match(deprovisioner, /update\(\{ status: 'suspended'/)
  assert.match(deprovisioner, /from\('user_role_assignments'\)/)
  assert.match(deprovisioner, /supabase\.auth\.admin\.deleteUser/)
  assert.match(deprovisioner, /verifyBlocked/)
  assert.match(deprovisioner, /verifyDeleted/)
  assert.doesNotMatch(deprovisioner, /insert\s+into\s+auth\.users/i)
})

test('account lifecycle commands remain explicit and operator-only', () => {
  assert.equal(
    packageJson.scripts['e2e:access:provision'],
    'node scripts/provision-e2e-access-profiles.mjs',
  )
  assert.equal(
    packageJson.scripts['e2e:access:deprovision'],
    'node scripts/deprovision-e2e-access-profiles.mjs',
  )
})
