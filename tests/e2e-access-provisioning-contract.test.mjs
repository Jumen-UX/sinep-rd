import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [script, packageJson, gitignore] = await Promise.all([
  readFile('scripts/provision-e2e-access-profiles.mjs', 'utf8'),
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('.gitignore', 'utf8'),
])

test('access provisioning uses the official server-side Auth admin API', () => {
  assert.match(script, /createClient.*@supabase\/supabase-js/)
  assert.match(script, /supabase\.auth\.admin\.listUsers/)
  assert.match(script, /supabase\.auth\.admin\.createUser/)
  assert.match(script, /supabase\.auth\.admin\.updateUserById/)
  assert.match(script, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(script, /from\(['"]auth\.users['"]\)/)
  assert.doesNotMatch(script, /insert\s+into\s+auth\.users/i)
})

test('access provisioning fails closed outside an explicitly confirmed QA context', () => {
  assert.match(script, /PROVISION_NON_PRODUCTION_E2E/)
  assert.match(script, /E2E_PROVISION_CONFIRM/)
  assert.match(script, /endsWith\('\.test'\)/)
  assert.match(script, /endsWith\('\.invalid'\)/)
  assert.match(script, /startsWith\('test-'\)/)
  assert.match(script, /Las entidades A y B deben ser distintas/)
})

test('generated credentials remain outside version control and are not printed', () => {
  assert.match(script, /randomBytes\(24\)/)
  assert.match(script, /mode: 0o600/)
  assert.match(script, /chmod\(absolutePath, 0o600\)/)
  assert.match(gitignore, /^\.secrets\/$/m)
  assert.doesNotMatch(script, /console\.log\([^\n]*password/i)
  assert.doesNotMatch(script, /console\.log\([^\n]*JSON\.stringify\(matrix/i)
})

test('provisioned matrix covers every access state and bidirectional roles', () => {
  for (const state of ['ready', 'onboarding', 'no_role', 'blocked']) {
    assert.match(script, new RegExp(`expectedState: '${state}'`))
  }
  assert.match(script, /roleKey: 'diocesan_admin'/)
  assert.match(script, /roleKey: 'internal_viewer'/)
  assert.match(script, /navigationRole: 'administrator'/)
  assert.match(script, /navigationRole: 'viewer'/)
  assert.match(script, /forbiddenEntityId: forbiddenEntity\.id/)
  assert.match(script, /minimumVisibleDioceses: 1/)
})

test('provisioning is idempotent, scoped and audited without persisting passwords', () => {
  assert.match(script, /from\('profiles'\)\.upsert/)
  assert.match(script, /from\('user_role_assignments'\)\.delete\(\)\.eq\('user_id', userId\)/)
  assert.match(script, /scope_type: 'diocese'/)
  assert.match(script, /provision_e2e_access_profile/)
  assert.match(script, /e2e_profile_key: spec\.key/)
  assert.doesNotMatch(script, /new_data:\s*\{[^}]*password/s)
})

test('package exposes an explicit operator-only provisioning command', () => {
  assert.equal(
    packageJson.scripts['e2e:access:provision'],
    'node scripts/provision-e2e-access-profiles.mjs',
  )
})
