import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const path = 'src/features/clero/priest/admin/PriestWizardPage.tsx'

test('priest wizard uses the shared identity step and preserves deacon continuity', async () => {
  const source = await readFile(path, 'utf8')

  assert.match(source, /PersonIdentityStep/)
  assert.match(source, /toIdentityMode/)
  assert.match(source, /toRegistrationMode/)
  assert.match(source, /existing_deacon_person_id: existingDeaconId \|\| null/)
  assert.match(source, /registration_mode/)
  assert.match(source, /setDraftField\('existing_deacon_person_id', ''\)/)
  assert.match(source, /Continuar el historial de un diácono sin crear otra persona/)
  assert.match(source, /savePriest\(payload\)/)
})
