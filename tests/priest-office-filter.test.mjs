import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

test('priest wizard never falls back to every office when a level has no mapping', async () => {
  const page = await readFile(
    new URL('src/features/clero/priest/admin/PriestWizardPage.tsx', repoRoot),
    'utf8',
  )

  assert.match(page, /const filteredOfficeConfigs = quickEntityId\s*\? officeConfigs\.filter\(\(office\) => allowedOfficeIds\.includes\(office\.id\)\)\s*:\s*\[\]/)
  assert.match(page, /Este nivel no tiene cargos configurados\. Configúralos en Administración → Estructura/)
  assert.match(page, /disabled=\{!quickEntityId \|\| filteredOfficeConfigs\.length === 0\}/)
  assert.doesNotMatch(page, /se muestran todos/)
})
