import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const routePath = 'src/app/(admin)/admin/organizacion/revision/page.tsx'
const pagePath = 'src/features/organizacion/admin/OrganizationUnitReviewPage.tsx'
const servicePath = 'src/features/organizacion/services/organization-unit-admin-service.ts'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('organization draft review route delegates to the organization feature', async () => {
  const route = await read(routePath)

  assert.match(route, /OrganizationUnitReviewPage/)
  assert.doesNotMatch(route, /createClient|\.from\(|\.rpc\(|fetch\(/)
})

test('organization draft review keeps approval separate from publication', async () => {
  const [page, service] = await Promise.all([read(pagePath), read(servicePath)])

  assert.match(page, /unit\.status === 'draft'/)
  assert.match(page, /transitionOrganizationUnit\(id, 'approve'\)/)
  assert.match(page, /La publicación seguirá siendo una acción separada/)
  assert.match(page, /visibilidad interna/)
  assert.match(page, /Seleccionar todas las unidades visibles/)
  assert.match(page, /Diócesis/)
  assert.match(page, /Organigrama/)
  assert.match(page, /Área pastoral/)
  assert.doesNotMatch(page, /transitionOrganizationUnit\(id, 'publish'\)/)
  assert.match(service, /transitionOrganizationUnit/)
})
