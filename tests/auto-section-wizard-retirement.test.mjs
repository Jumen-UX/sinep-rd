import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

async function doesNotExist(path) {
  try {
    await access(new URL(path, repoRoot))
    return false
  } catch {
    return true
  }
}

const personStyles = await source('src/styles/person-wizard-ui.css')
const controlledStyles = await source('src/styles/person-registration-wizard.css')

const controlledFlows = [
  {
    page: 'src/features/clero/priest/admin/PriestWizardPage.tsx',
    layout: 'src/app/(admin)/admin/nuevo/sacerdote/layout.tsx',
  },
  {
    page: 'src/features/clero/deacon/admin/DeaconWizardPage.tsx',
    layout: 'src/app/(admin)/admin/nuevo/diacono/layout.tsx',
  },
  {
    page: 'src/features/clero/bishop/admin/BishopWizardPage.tsx',
    layout: 'src/app/(admin)/admin/nuevo/obispo/layout.tsx',
  },
  {
    page: 'src/features/personas/lay/admin/LayPersonWizardPage.tsx',
    layout: 'src/app/(admin)/admin/nuevo/laico/layout.tsx',
  },
  {
    page: 'src/features/vida-consagrada/religious/admin/ReligiousWizardPage.tsx',
    layout: 'src/app/(admin)/admin/nuevo/religioso/layout.tsx',
  },
]

test('automatic DOM observer wizard is physically retired', async () => {
  assert.equal(
    await doesNotExist('src/components/admin/AutoSectionWizard.tsx'),
    true,
  )
  assert.doesNotMatch(personStyles, /auto-section-wizard/)
})

test('all migrated registration flows own explicit progress and do not import the retired wrapper', async () => {
  for (const flow of controlledFlows) {
    const [page, layout] = await Promise.all([
      source(flow.page),
      source(flow.layout),
    ])

    assert.match(page, /AdminWizardProgress/)
    assert.match(page, /const wizardSteps = \[/)
    assert.doesNotMatch(page, /MutationObserver|requestSubmit|AutoSectionWizard/)
    assert.doesNotMatch(layout, /AutoSectionWizard/)
  }
})

test('person registration styles remain semantic after wrapper retirement', () => {
  assert.match(controlledStyles, /\.admin-lay-wizard/)
  assert.match(controlledStyles, /\.admin-religious-wizard/)
  assert.match(controlledStyles, /box-shadow: var\(--focus-ring\)/)
  assert.doesNotMatch(controlledStyles, /auto-section-wizard/)
  assert.doesNotMatch(personStyles, /outline:\s*3px solid var\(--focus-ring\)/)
  assert.match(personStyles, /box-shadow: var\(--focus-ring\)/)
})
