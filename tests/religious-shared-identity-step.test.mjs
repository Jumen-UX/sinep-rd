import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const wizardPath = 'src/features/vida-consagrada/religious/admin/ReligiousWizardPage.tsx'

test('consecrated life wizard uses the shared identity step without changing its canonical payload', async () => {
  const source = await readFile(wizardPath, 'utf8')

  assert.match(source, /PersonIdentityStep/)
  assert.match(source, /mode=\{mode\}/)
  assert.match(source, /onModeChange=\{setMode\}/)
  assert.match(source, /selectedPersonId=\{selectedPersonId\}/)
  assert.match(source, /onSelectedPersonChange=\{setSelectedPersonId\}/)
  assert.match(source, /people=\{candidates\}/)
  assert.match(source, /selected_person_id: mode === 'existing' \? selectedPersonId : null/)
  assert.match(source, /religious_life_type: lifeType/)
  assert.match(source, /Vida consagrada añadida a la ficha/)
})

test('priest religious life remains delegated to the canonical priest flow', async () => {
  const source = await readFile(wizardPath, 'utf8')

  assert.match(source, /if \(lifeType === 'priest'\)/)
  assert.match(source, /router\.push\('\/admin\/nuevo\/sacerdote'\)/)
  assert.match(source, /Ese asistente registra el presbiterado y la vida consagrada sobre la misma persona/)
})
