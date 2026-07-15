import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const progressMigrationPath = 'supabase/migrations/20260714054000_admin_user_onboarding_progress.sql'
const usersPagePath = 'src/features/access/admin/UserAccessPage.tsx'
const servicePath = 'src/features/access/services/user-access-admin-service.ts'

test('user administration exposes onboarding progress and effective access state', async () => {
  const [sql, service, page] = await Promise.all([
    readFile(progressMigrationPath, 'utf8'),
    readFile(servicePath, 'utf8'),
    readFile(usersPagePath, 'utf8'),
  ])

  assert.match(sql, /admin_list_user_onboarding_progress/)
  assert.match(sql, /p\.onboarding_completed_at is null then 'onboarding'/)
  assert.match(sql, /then 'no_role'/)
  assert.match(sql, /else 'ready'/)
  assert.match(service, /admin_list_user_onboarding_progress/)
  assert.match(service, /getUserOnboardingLabel/)
  assert.match(page, /getUserOnboardingLabel\(user\)/)
  assert.match(page, /user\.access_state === 'ready'/)
})
