import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('deacon route delegates to the clergy feature domain', async () => {
  const route = await readRepoFile('src/app/(admin)/admin/nuevo/diacono/page.tsx')
  const featureIndex = await readRepoFile('src/features/clero/deacon/index.ts')

  assert.equal(route.trim(), "export { DeaconWizardPage as default } from '@/features/clero/deacon'")
  assert.match(featureIndex, /DeaconWizardPage/)
  assert.match(featureIndex, /deacon-admin-service/)
})

test('deacon wizard delegates persistence and catalog reads to typed services', async () => {
  const page = await readRepoFile('src/features/clero/deacon/admin/DeaconWizardPage.tsx')

  for (const operation of [
    'loadDeaconCatalogs',
    'loadAllowedOfficeIds',
    'uploadDeaconPhoto',
    'removeDeaconPhoto',
    'saveDeacon',
  ]) {
    assert.match(page, new RegExp(operation))
  }

  assert.doesNotMatch(page, /\.from\(/)
  assert.doesNotMatch(page, /\.storage\./)
  assert.doesNotMatch(page, /fetch\('\/api\/admin\/diacono'/)
  assert.match(page, /Este nivel no tiene cargos configurados/)
})

test('clergy services share entity, office, level and photo infrastructure', async () => {
  const shared = await readRepoFile('src/features/clero/shared/services/clergy-admin-service.ts')
  const deacon = await readRepoFile('src/features/clero/deacon/services/deacon-admin-service.ts')
  const priest = await readRepoFile('src/features/clero/priest/services/priest-admin-service.ts')

  assert.match(shared, /from\('admin_entity_hierarchy_selector'\)/)
  assert.match(shared, /from\('office_configurations'\)/)
  assert.match(shared, /from\('structure_level_office_configurations'\)/)
  assert.match(shared, /const PHOTO_BUCKET = 'person-photos'/)

  assert.match(deacon, /loadClergyPlacementCatalogs/)
  assert.match(deacon, /uploadClergyPhoto/)
  assert.match(deacon, /fetch\('\/api\/admin\/diacono'/)

  assert.match(priest, /loadClergyPlacementCatalogs/)
  assert.match(priest, /uploadClergyPhoto/)
  assert.doesNotMatch(priest, /from\('admin_entity_hierarchy_selector'\)/)
  assert.doesNotMatch(priest, /storage\.from\(PHOTO_BUCKET\)/)
})
