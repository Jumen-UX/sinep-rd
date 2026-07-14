import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routePath = 'src/app/(admin)/admin/actividad/page.tsx'
const pagePath = 'src/features/audit/admin/AdministrativeActivityPage.tsx'
const servicePath = 'src/features/audit/services/audit-admin-service.ts'

const directSupabaseFrom = /\bsupabase\s*\.\s*from\s*\(/
const directSupabaseRpc = /\bsupabase\s*\.\s*rpc\s*\(/

test('administrative activity route delegates to the audit feature', async () => {
  const route = await readFile(routePath, 'utf8')

  assert.match(route, /from '@\/features\/audit'/)
  assert.doesNotMatch(route, /createClient/)
  assert.doesNotMatch(route, directSupabaseFrom)
  assert.doesNotMatch(route, directSupabaseRpc)
  assert.doesNotMatch(route, /fetch\s*\(/)
})

test('administrative activity RPC remains behind the audit service', async () => {
  const [page, service] = await Promise.all([
    readFile(pagePath, 'utf8'),
    readFile(servicePath, 'utf8'),
  ])

  assert.match(page, /loadRecentAdministrativeActivity/)
  assert.doesNotMatch(page, directSupabaseFrom)
  assert.doesNotMatch(page, directSupabaseRpc)
  assert.match(service, /admin_list_recent_audit_logs/)
  assert.match(service, /p_limit/)
  assert.match(service, /auth\.getUser/)
})
