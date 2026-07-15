import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('shared placement service resolves offices only from the selected structural level', async () => {
  const service = await readRepoFile(
    'src/features/personas/shared/services/person-placement-service.ts',
  )

  assert.match(service, /from\('structure_nodes'\)/)
  assert.match(service, /linked_ecclesiastical_entity_id/)
  assert.match(service, /const levelId/)
  assert.match(service, /if \(!levelId\) return \[\]/)
  assert.match(service, /from\('structure_level_office_configurations'\)/)
  assert.match(service, /\.eq\('level_id', levelId\)/)
  assert.match(service, /\.eq\('status', 'active'\)/)
  assert.doesNotMatch(service, /return\s+officeResult\.data/)
  assert.doesNotMatch(service, /if \([^)]*length === 0[^)]*\)[\s\S]{0,120}office_configurations/)
})

test('every person wizard filters office catalogs with the shared allowed id contract', async () => {
  const pages = [
    'src/features/clero/deacon/admin/DeaconWizardPage.tsx',
    'src/features/clero/priest/admin/PriestWizardPage.tsx',
    'src/features/clero/bishop/admin/BishopWizardPage.tsx',
    'src/features/vida-consagrada/religious/admin/ReligiousWizardPage.tsx',
    'src/features/personas/lay/admin/LayPersonWizardPage.tsx',
  ]

  for (const path of pages) {
    const page = await readRepoFile(path)

    assert.match(page, /loadAllowedOfficeIds/)
    assert.match(page, /allowedOfficeIds\.includes\(office\.id\)/)
    assert.match(page, /filteredOfficeConfigs/)
    assert.match(page, /filteredOfficeConfigs\.length === 0/)
    assert.match(page, /setAllowedOfficeIds\(\[\]\)/)
    assert.doesNotMatch(page, /filteredOfficeConfigs\s*=\s*[^\n]*\?[^\n]*officeConfigs\s*:/)
  }
})

test('person wizards clear an office that becomes incompatible after changing entity', async () => {
  const pages = [
    'src/features/clero/deacon/admin/DeaconWizardPage.tsx',
    'src/features/clero/priest/admin/PriestWizardPage.tsx',
    'src/features/clero/bishop/admin/BishopWizardPage.tsx',
    'src/features/vida-consagrada/religious/admin/ReligiousWizardPage.tsx',
    'src/features/personas/lay/admin/LayPersonWizardPage.tsx',
  ]

  for (const path of pages) {
    const page = await readRepoFile(path)

    assert.match(page, /!filteredOfficeConfigs\.some\(\(office\) => office\.id === quickOfficeConfigId\)/)
    assert.match(page, /setQuickOfficeConfigId\(''\)/)
  }
})
