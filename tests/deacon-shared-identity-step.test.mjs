import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const pagePath = 'src/features/clero/deacon/admin/DeaconWizardPage.tsx'

test('deacon wizard uses the shared person identity step without changing canonical payload semantics', async () => {
  const source = await readFile(pagePath, 'utf8')

  assert.match(source, /PersonIdentityStep/)
  assert.match(source, /mode=\{mode\}/)
  assert.match(source, /onModeChange=\{setMode\}/)
  assert.match(source, /selectedPersonId=\{selectedPersonId\}/)
  assert.match(source, /onSelectedPersonChange=\{setSelectedPersonId\}/)
  assert.match(source, /people=\{unordainedPeople\}/)
  assert.match(source, /selected_person_id: mode === 'existing' \? selectedPersonId : null/)
  assert.match(source, /mode === 'existing' && !selectedPersonId/)
  assert.match(source, /mode === 'new' && \(!firstName \|\| !lastName \|\| !displayName \|\| !slug\)/)
  assert.doesNotMatch(source, /<h2>¿La persona ya está registrada\?<\/h2>[\s\S]*Persona existente[\s\S]*Identidad nueva[\s\S]*<\/section>/)
})
