import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

const wizardContracts = [
  {
    path: 'src/features/clero/deacon/admin/DeaconWizardPage.tsx',
    filteredCollection: 'filteredOfficeConfigs',
    selectedOfficeId: 'quickOfficeConfigId',
    clearSelection: "setQuickOfficeConfigId('')",
  },
  {
    path: 'src/features/clero/priest/admin/PriestWizardPage.tsx',
    filteredCollection: 'filteredOfficeConfigs',
    selectedOfficeId: 'quickOfficeConfigId',
    clearSelection: "setQuickOfficeConfigId('')",
  },
  {
    path: 'src/features/clero/bishop/admin/BishopWizardPage.tsx',
    filteredCollection: 'filteredOffices',
    selectedOfficeId: 'officeConfigurationId',
    clearSelection: "setOfficeConfigurationId('')",
  },
  {
    path: 'src/features/vida-consagrada/religious/admin/ReligiousWizardPage.tsx',
    filteredCollection: 'filteredOfficeConfigs',
    selectedOfficeId: 'quickOfficeConfigId',
    clearSelection: "setQuickOfficeConfigId('')",
  },
  {
    path: 'src/features/personas/lay/admin/LayPersonWizardPage.tsx',
    filteredCollection: 'filteredOfficeConfigs',
    selectedOfficeId: 'quickOfficeConfigId',
    clearSelection: "setQuickOfficeConfigId('')",
  },
]

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
  for (const contract of wizardContracts) {
    const page = await readRepoFile(contract.path)
    const filteredCollection = escapeRegExp(contract.filteredCollection)

    assert.match(page, /loadAllowedOfficeIds/)
    assert.match(page, /allowedOfficeIds\.includes\(office\.id\)/)
    assert.match(page, new RegExp(`const ${filteredCollection} =`))
    assert.match(page, new RegExp(`${filteredCollection}\\.length === 0`))
    assert.match(page, /setAllowedOfficeIds\(\[\]\)/)
    assert.doesNotMatch(
      page,
      new RegExp(`${filteredCollection}\\s*=\\s*[^\\n]*\\?[^\\n]*(?:officeConfigs|offices)\\s*:`),
    )
  }
})

test('person wizards clear an office that becomes incompatible after changing entity', async () => {
  for (const contract of wizardContracts) {
    const page = await readRepoFile(contract.path)
    const filteredCollection = escapeRegExp(contract.filteredCollection)
    const selectedOfficeId = escapeRegExp(contract.selectedOfficeId)

    assert.match(
      page,
      new RegExp(`!${filteredCollection}\\.some\\(\\(office\\) => office\\.id === ${selectedOfficeId}\\)`),
    )
    assert.match(page, new RegExp(escapeRegExp(contract.clearSelection)))
  }
})
