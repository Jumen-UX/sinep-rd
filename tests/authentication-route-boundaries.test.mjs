import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const loginRoutePath = 'src/app/(admin)/admin/login/page.tsx'
const resetRoutePath = 'src/app/(admin)/admin/usuarios/recuperar/page.tsx'
const loginPagePath = 'src/features/access/admin/AdminLoginPage.tsx'
const resetPagePath = 'src/features/access/admin/ResetAccessPage.tsx'
const servicePath = 'src/features/access/services/authentication-admin-service.ts'

const directSupabaseAuth = /supabase\s*\.\s*auth\s*\./

test('authentication routes delegate to the access feature', async () => {
  const [loginRoute, resetRoute] = await Promise.all([
    readFile(loginRoutePath, 'utf8'),
    readFile(resetRoutePath, 'utf8'),
  ])

  for (const route of [loginRoute, resetRoute]) {
    assert.match(route, /from '@\/features\/access'/)
    assert.doesNotMatch(route, /createClient/)
    assert.doesNotMatch(route, /fetch\s*\(/)
    assert.doesNotMatch(route, directSupabaseAuth)
  }
})

test('authentication pages delegate I/O to their service', async () => {
  const [loginPage, resetPage] = await Promise.all([
    readFile(loginPagePath, 'utf8'),
    readFile(resetPagePath, 'utf8'),
  ])

  assert.match(loginPage, /signInAdmin/)
  assert.match(loginPage, /getSafeAdminNextPath/)
  assert.doesNotMatch(loginPage, /signInWithPassword/)

  assert.match(resetPage, /requestAdminAccessReset/)
  assert.doesNotMatch(resetPage, /fetch\s*\(/)
})

test('authentication service owns login and recovery boundaries', async () => {
  const service = await readFile(servicePath, 'utf8')

  assert.match(service, /signInWithPassword/)
  assert.match(service, /\/api\/admin\/users\/reset-access/)
  assert.match(service, /next\.startsWith\('\/'\)/)
  assert.match(service, /next\.startsWith\('\/\/'\)/)
})
