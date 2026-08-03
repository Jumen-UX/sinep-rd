import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('personal center exposes its own navigation shell', async () => {
  const [layout, shell, styles] = await Promise.all([
    read('src/app/(account)/cuenta/layout.tsx'),
    read('src/features/account/AccountShell.tsx'),
    read('src/features/account/account.module.css'),
  ])

  assert.match(layout, /<AccountShell>\{children\}<\/AccountShell>/)
  assert.match(shell, /aria-label="Navegación del Centro Personal"/)
  assert.match(shell, /href: '\/cuenta\/perfil'/)
  assert.match(styles, /grid-template-columns:\s*250px minmax\(0, 1fr\)/)
  assert.match(styles, /@media \(max-width: 900px\)/)
})

test('profile route updates only the authenticated account contract', async () => {
  const [page, form, service] = await Promise.all([
    read('src/app/(account)/cuenta/perfil/page.tsx'),
    read('src/features/account/AccountProfileForm.tsx'),
    read('src/features/account/services/account-service.ts'),
  ])

  assert.match(page, /redirect\('\/admin\/login\?next=\/cuenta\/perfil'\)/)
  assert.match(page, /<AccountProfileForm profile=\{profile\}/)
  assert.match(form, /saveMyAccountProfile/)
  assert.match(form, /role="alert"/)
  assert.match(form, /role="status"/)
  assert.match(service, /supabase\.rpc\('save_my_account_profile'/)
  assert.doesNotMatch(service, /from\(['"]profiles['"]\)/)
  assert.doesNotMatch(service, /user_role_assignments/)
})
