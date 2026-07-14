import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routePath = 'src/app/(admin)/admin/configuracion/page.tsx'
const featurePath = 'src/features/configuration/admin/ConfigurationPage.tsx'
const servicePath = 'src/features/configuration/services/configuration-admin-service.ts'

const directSupabaseFrom = /\bsupabase\s*\.\s*from\s*\(/
const directSupabaseRpc = /\bsupabase\s*\.\s*rpc\s*\(/

test('configuration route delegates to the configuration feature', async () => {
  const route = await readFile(routePath, 'utf8')

  assert.match(route, /from '@\/features\/configuration'/)
  assert.doesNotMatch(route, /createClient/)
  assert.doesNotMatch(route, directSupabaseFrom)
  assert.doesNotMatch(route, directSupabaseRpc)
  assert.doesNotMatch(route, /fetch\s*\(/)
})

test('configuration feature delegates session access to its service', async () => {
  const [feature, service] = await Promise.all([
    readFile(featurePath, 'utf8'),
    readFile(servicePath, 'utf8'),
  ])

  assert.match(feature, /hasConfigurationAdminSession/)
  assert.match(feature, /\/admin\/estado-fichas/)
  assert.doesNotMatch(feature, /supabase\.auth\.getUser/)
  assert.doesNotMatch(feature, directSupabaseFrom)
  assert.doesNotMatch(feature, directSupabaseRpc)

  assert.match(service, /supabase\.auth\.getUser/)
  assert.match(service, /hasConfigurationAdminSession/)
})
