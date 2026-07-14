import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('organization admin route delegates to the canonical feature', async () => {
  const route = await read('src/app/(admin)/admin/organizacion/page.tsx')
  assert.match(route, /OrganizationUnitManagerPage/)
})

test('organization unit service loads scoped catalogs and saves through the server route', async () => {
  const service = await read('src/features/organizacion/services/organization-unit-admin-service.ts')

  assert.match(service, /from\('organization_charts'\)/)
  assert.match(service, /from\('organization_units'\)/)
  assert.match(service, /from\('pastoral_areas'\)/)
  assert.match(service, /\/api\/admin\/organizacion/)
  assert.doesNotMatch(service, /\.insert\(|\.update\(|\.delete\(/)
})

test('organization unit API applies permission and canonical RPC contracts', async () => {
  const api = await read('src/app/api/admin/organizacion/route.ts')

  assert.match(api, /pastorals\.create_proposal/)
  assert.match(api, /pastorals\.update_proposal/)
  assert.match(api, /admin_save_organization_unit/)
  assert.match(api, /revalidatePublicContent/)
})

test('organization manager exposes filters tree parent selection and explicit lifecycle states', async () => {
  const page = await read('src/features/organizacion/admin/OrganizationUnitManagerPage.tsx')

  assert.match(page, /flattenTree/)
  assert.match(page, /descendantIds/)
  assert.match(page, /Diócesis y organigrama/)
  assert.match(page, /Unidad superior/)
  assert.match(page, /Área pastoral/)
  assert.match(page, /status === 'active' \? 'Activa'/)
  assert.match(page, /action: 'approve', label: 'Aprobar unidad'/)
  assert.match(page, /permiso de publicación/)
})

test('admin shell exposes organization management', async () => {
  const shell = await read('src/app/(admin)/admin/AdminShell.tsx')
  assert.match(shell, /href: '\/admin\/organizacion'/)
  assert.match(shell, /label: 'Organización'/)
})
