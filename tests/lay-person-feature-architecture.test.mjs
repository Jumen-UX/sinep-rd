import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('lay route delegates to the persons feature domain', async () => {
  const route = await readRepoFile('src/app/(admin)/admin/nuevo/laico/page.tsx')
  const featureIndex = await readRepoFile('src/features/personas/lay/index.ts')

  assert.equal(route.trim(), "export { LayPersonWizardPage as default } from '@/features/personas/lay'")
  assert.match(featureIndex, /LayPersonWizardPage/)
  assert.match(featureIndex, /lay-person-admin-service/)
})

test('lay wizard delegates catalogs, storage and persistence to typed services', async () => {
  const page = await readRepoFile('src/features/personas/lay/admin/LayPersonWizardPage.tsx')

  for (const operation of [
    'loadLayPersonCatalogs',
    'loadAllowedOfficeIds',
    'uploadLayPersonPhoto',
    'removeLayPersonPhoto',
    'saveLayPerson',
  ]) {
    assert.match(page, new RegExp(operation))
  }

  assert.doesNotMatch(page, /\.from\(/)
  assert.doesNotMatch(page, /\.storage\./)
  assert.doesNotMatch(page, /fetch\('\/api\/admin\/laico'/)
  assert.match(page, /Este nivel no tiene cargos configurados/)
  assert.match(page, /officeConfigs\.filter\(\(office\) => allowedOfficeIds\.includes\(office\.id\)\)/)
})

test('lay condition is presented as derived from absence of ordinations', async () => {
  const page = await readRepoFile('src/features/personas/lay/admin/LayPersonWizardPage.tsx')
  const service = await readRepoFile('src/features/personas/lay/services/lay-person-admin-service.ts')

  assert.match(page, /La condición laical se deriva de que la persona no tiene ninguna ordenación registrada/)
  assert.match(page, /se conservará esta misma ficha y se añadirá el evento sacramental/)
  assert.doesNotMatch(page, /person_type/)
  assert.doesNotMatch(service, /clero/)
  assert.match(service, /loadPersonPlacementCatalogs/)
  assert.match(service, /uploadPersonPhoto/)
})
