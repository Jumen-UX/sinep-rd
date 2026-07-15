import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routeFiles = [
  'src/app/(admin)/admin/usuarios/page.tsx',
  'src/app/(admin)/admin/usuarios/invitar/page.tsx',
]

test('user access routes delegate to the access feature', async () => {
  for (const routeFile of routeFiles) {
    const source = await readFile(routeFile, 'utf8')

    assert.match(source, /from '@\/features\/access'/)
    assert.doesNotMatch(source, /createClient/)
    assert.doesNotMatch(source, /\.from\s*\(/)
    assert.doesNotMatch(source, /\.rpc\s*\(/)
    assert.doesNotMatch(source, /fetch\s*\(/)
  }
})

test('user access mutations stay behind the feature service and audited endpoints', async () => {
  const service = await readFile(
    'src/features/access/services/user-access-admin-service.ts',
    'utf8',
  )

  assert.match(service, /admin_list_users/)
  assert.match(service, /admin_list_user_onboarding_progress/)
  assert.match(service, /admin_list_roles_with_permissions/)
  assert.match(service, /admin_assign_user_role/)
  assert.match(service, /admin_update_user_profile_status/)
  assert.match(service, /admin_end_user_role/)
  assert.match(service, /\/api\/admin\/users\/create-invite/)
})
