import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('personal center navigation exposes only implemented account sections', async () => {
  const source = await read('src/features/account/AccountShell.tsx')

  assert.match(source, /href: '\/cuenta'/)
  assert.match(source, /href: '\/cuenta\/perfil'/)
  assert.match(source, /href: '\/cuenta\/seguridad'/)
  assert.match(source, /href: '\/cuenta\/accesos'/)
  assert.match(source, /href: '\/cuenta\/solicitudes'/)
  assert.doesNotMatch(source, /\/cuenta\/(?:notificaciones|mensajes|privacidad)/)
})

test('personal dashboard uses canonical account context without direct table reads', async () => {
  const source = await read('src/features/account/AccountHomePage.tsx')

  assert.match(source, /loadMyAccountContext\(supabase\)/)
  assert.match(source, /Acciones rápidas/)
  assert.match(source, /calculateProfileCompletion/)
  assert.doesNotMatch(source, /\.from\(['"](?:profiles|access_requests|user_role_assignments)['"]\)/)
})

test('access and request pages remain authenticated server-rendered projections', async () => {
  const accessPage = await read('src/app/(account)/cuenta/accesos/page.tsx')
  const requestsPage = await read('src/app/(account)/cuenta/solicitudes/page.tsx')

  for (const source of [accessPage, requestsPage]) {
    assert.match(source, /supabase\.auth\.getUser\(\)/)
    assert.match(source, /loadMyAccountContext\(supabase\)/)
    assert.doesNotMatch(source, /^['"]use client['"]/m)
    assert.doesNotMatch(source, /\.from\(/)
  }
})

test('personal center styles preserve responsive navigation and single-column mobile content', async () => {
  const css = await read('src/features/account/account.module.css')

  assert.match(css, /\.quickActionsGrid\{display:grid/)
  assert.match(css, /\.authorizationGrid\{display:grid/)
  assert.match(css, /@media\(max-width:900px\).*?\.navigation\{grid-template-columns:repeat\(5,minmax\(180px,1fr\)\);overflow-x:auto/s)
  assert.match(css, /@media\(max-width:800px\).*?\.summaryGrid,\.contentGrid,\.formGrid,\.requestMetadata\{grid-template-columns:1fr\}/s)
})
