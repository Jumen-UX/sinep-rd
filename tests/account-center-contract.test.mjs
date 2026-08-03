import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routePath = 'src/app/(account)/cuenta/page.tsx'
const pagePath = 'src/features/account/AccountHomePage.tsx'
const servicePath = 'src/features/account/services/account-service.ts'
const stylePath = 'src/features/account/account.module.css'

test('account center is an authenticated route independent from admin permissions', async () => {
  const [route, page, service] = await Promise.all([
    readFile(routePath, 'utf8'),
    readFile(pagePath, 'utf8'),
    readFile(servicePath, 'utf8'),
  ])

  assert.match(route, /AccountHomePage/)
  assert.match(page, /supabase\.auth\.getUser\(\)/)
  assert.match(page, /redirect\('\/admin\/login\?next=\/cuenta'\)/)
  assert.match(page, /loadMyAccountContext/)
  assert.doesNotMatch(page, /'use client'/)
  assert.doesNotMatch(page, /get_my_admin_entry_context/)
  assert.match(service, /get_my_account_context/)
})

test('account overview exposes profile, access and request states without write duplication', async () => {
  const [page, service] = await Promise.all([
    readFile(pagePath, 'utf8'),
    readFile(servicePath, 'utf8'),
  ])

  assert.match(page, /Mi perfil/)
  assert.match(page, /Mis accesos/)
  assert.match(page, /Solicitudes abiertas/)
  assert.match(page, /Acceso administrativo pendiente/)
  assert.match(page, /href="\/cuenta\/accesos"/)
  assert.match(page, /href="\/cuenta\/solicitudes"/)
  assert.match(service, /registration_source/)
  assert.match(service, /access_requests/)
  assert.doesNotMatch(page, /\.from\s*\(/)
  assert.doesNotMatch(page, /\.rpc\s*\(/)
})

test('account center remains responsive and touch accessible', async () => {
  const css = await readFile(stylePath, 'utf8')

  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
  assert.match(css, /min-height:\s*44px/)
  assert.match(css, /@media\s*\(max-width:\s*800px\)/)
  assert.match(css, /grid-template-columns:\s*1fr/)
  assert.match(css, /overflow-wrap:\s*anywhere/)
})
