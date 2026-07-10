import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('religious route delegates to the consecrated life feature domain', async () => {
  const route = await readRepoFile('src/app/(admin)/admin/nuevo/religioso/page.tsx')
  const featureIndex = await readRepoFile('src/features/vida-consagrada/religious/index.ts')

  assert.equal(route.trim(), "export { ReligiousWizardPage as default } from '@/features/vida-consagrada/religious'")
  assert.match(featureIndex, /ReligiousWizardPage/)
  assert.match(featureIndex, /religious-admin-service/)
})

test('religious wizard delegates catalogs, photos and persistence to typed services', async () => {
  const page = await readRepoFile('src/features/vida-consagrada/religious/admin/ReligiousWizardPage.tsx')

  for (const operation of [
    'loadReligiousCatalogs',
    'loadAllowedOfficeIds',
    'uploadReligiousPhoto',
    'removeReligiousPhoto',
    'saveReligious',
  ]) {
    assert.match(page, new RegExp(operation))
  }

  assert.doesNotMatch(page, /\.from\(/)
  assert.doesNotMatch(page, /\.storage\./)
  assert.doesNotMatch(page, /fetch\('\/api\/admin\/religioso'/)
  assert.match(page, /Este nivel no tiene cargos configurados/)
  assert.match(page, /officeConfigs\.filter\(\(office\) => allowedOfficeIds\.includes\(office\.id\)\)/)
})

test('religious flow keeps priests in the canonical priest history', async () => {
  const page = await readRepoFile('src/features/vida-consagrada/religious/admin/ReligiousWizardPage.tsx')

  assert.match(page, /lifeType === 'priest'/)
  assert.match(page, /router\.push\('\/admin\/nuevo\/sacerdote'\)/)
  assert.match(page, /Sacerdote religioso/)
})

test('religious service reuses neutral person infrastructure', async () => {
  const service = await readRepoFile('src/features/vida-consagrada/religious/services/religious-admin-service.ts')

  assert.match(service, /person-placement-service/)
  assert.match(service, /loadPersonPlacementCatalogs/)
  assert.match(service, /uploadPersonPhoto/)
  assert.match(service, /removePersonPhoto/)
  assert.match(service, /fetch\('\/api\/admin\/religioso'/)
})
