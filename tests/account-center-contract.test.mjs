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

test('account overview exposes profile access and request states without write duplication', async () => {
  const [page, service] = await Promise.all([
    readFile(pagePath, 'utf8'),
    readFile(servicePath, 'utf8'),
  ])

  assert.match(page, /Mi perfil/)
  assert.match(page, /Mi acceso/)
  assert.match(page, /Mis solicitudes/)
  assert.match(page, /Acceso administrativo pendiente/)
  assert.match(service, /registration_source/)
  assert.match(service, /access_requests/)
  assert.doesNotMatch(page, /\.from\s*\(/)
  assert.doesNotMatch(page, /\.rpc\s*\(/)
})

test('account center remains responsive and touch accessible', async () => {
  const css = await readFile(stylePath, 'utf8')

  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(css, /min-height: 44px/)
  assert.match(css, /@media \(max-width: 800px\)/)
  assert.match(css, /grid-template-columns: 1fr/)
  assert.match(css, /overflow-wrap: anywhere/)
})
