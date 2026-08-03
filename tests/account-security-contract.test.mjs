import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pagePath = 'src/app/(account)/cuenta/seguridad/page.tsx'
const managerPath = 'src/features/account/AccountSecurityManager.tsx'
const shellPath = 'src/features/account/AccountShell.tsx'
const cssPath = 'src/features/account/account-security.module.css'

test('personal security route requires authentication and exposes real account controls', async () => {
  const [page, manager, shell] = await Promise.all([
    readFile(pagePath, 'utf8'),
    readFile(managerPath, 'utf8'),
    readFile(shellPath, 'utf8'),
  ])

  assert.match(page, /supabase\.auth\.getUser\(\)/)
  assert.match(page, /redirect\('\/admin\/login\?next=\/cuenta\/seguridad'\)/)
  assert.match(shell, /href: '\/cuenta\/seguridad'/)
  assert.match(manager, /supabase\.auth\.updateUser\(\{ password \}\)/)
  assert.match(manager, /supabase\.auth\.signOut\(\{ scope: 'others' \}\)/)
  assert.doesNotMatch(manager, /service_role|admin\.deleteUser|admin\.updateUserById/)
})

test('password change validates measurable criteria and prevents duplicate actions', async () => {
  const manager = await readFile(managerPath, 'utf8')

  assert.match(manager, /MIN_PASSWORD_LENGTH = 12/)
  assert.match(manager, /upper: \/\[A-Z\]\//)
  assert.match(manager, /lower: \/\[a-z\]\//)
  assert.match(manager, /number: \/\\d\//)
  assert.match(manager, /symbol: \/\[\^A-Za-z0-9\]\//)
  assert.match(manager, /password === confirmation/)
  assert.match(manager, /disabled=\{!passwordValid \|\| busy !== null\}/)
  assert.match(manager, /role="alert"/)
  assert.match(manager, /role="status"/)
})

test('security workspace remains responsive and does not invent device inventory', async () => {
  const [manager, css] = await Promise.all([
    readFile(managerPath, 'utf8'),
    readFile(cssPath, 'utf8'),
  ])

  assert.match(manager, /Supabase no expone aquí un inventario confiable/)
  assert.match(manager, /Autenticación en dos pasos/)
  assert.match(css, /min-height:44px/)
  assert.match(css, /@media\(max-width:800px\)/)
  assert.match(css, /grid-template-columns:1fr/)
})
