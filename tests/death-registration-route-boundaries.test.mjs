import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routePath = 'src/app/(admin)/admin/fallecimiento/page.tsx'
const pagePath = 'src/features/person-status/admin/DeathRegistrationPage.tsx'
const servicePath = 'src/features/person-status/services/death-registration-admin-service.ts'

const directSupabaseFrom = /\bsupabase\s*\.\s*from\s*\(/
const directSupabaseRpc = /\bsupabase\s*\.\s*rpc\s*\(/

test('death registration route delegates to person-status feature', async () => {
  const route = await readFile(routePath, 'utf8')
  assert.match(route, /from '@\/features\/person-status'/)
  assert.doesNotMatch(route, /createClient/)
  assert.doesNotMatch(route, directSupabaseFrom)
  assert.doesNotMatch(route, directSupabaseRpc)
  assert.doesNotMatch(route, /fetch\s*\(/)
})

test('death registration I/O stays behind its service', async () => {
  const [page, service] = await Promise.all([
    readFile(pagePath, 'utf8'),
    readFile(servicePath, 'utf8'),
  ])

  assert.match(page, /death-registration-admin-service/)
  assert.match(page, /loadDeathRegistrationPeople/)
  assert.match(page, /registerDeath/)
  assert.doesNotMatch(page, directSupabaseFrom)
  assert.doesNotMatch(page, directSupabaseRpc)
  assert.doesNotMatch(page, /fetch\s*\(/)

  assert.match(service, /from\('persons'\)/)
  assert.match(service, /\/api\/admin\/fallecimiento/)
  assert.match(service, /hasDeathRegistrationSession/)
})
