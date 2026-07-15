import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const wizardPath = 'src/features/personas/lay/admin/LayPersonWizardPage.tsx'

test('lay wizard uses the shared identity step and preserves canonical reuse', async () => {
  const source = await readFile(wizardPath, 'utf8')

  assert.match(source, /PersonIdentityStep/)
  assert.match(source, /selected_person_id: mode === 'existing' \? selectedPersonId : null/)
  assert.match(source, /saveLayPerson\(payload\)/)
  assert.match(source, /La identidad no cambiará si posteriormente se registra una ordenación o vida consagrada\./)
  assert.doesNotMatch(source, /<h2>¿La persona ya está registrada\?<\/h2>/)
})
