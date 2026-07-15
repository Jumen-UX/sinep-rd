import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const bishopWizardPath = 'src/features/clero/bishop/admin/BishopWizardPage.tsx'

test('bishop wizard uses the shared identity step without changing its canonical payload', async () => {
  const source = await readFile(bishopWizardPath, 'utf8')

  assert.match(source, /PersonIdentityStep/)
  assert.match(source, /mode=\{mode\}/)
  assert.match(source, /onModeChange=\{setMode\}/)
  assert.match(source, /selectedPersonId=\{selectedClergyId\}/)
  assert.match(source, /people=\{priestRecords\}/)
  assert.match(source, /selected_clergy_id: selectedClergyId \|\| null/)
  assert.match(source, /mode === 'existing' && !selectedClergyId/)
  assert.match(source, /highest_ordination_degree === 'presbyterate'/)
})

test('bishop wizard keeps sacrament role status dignity and appointment separated', async () => {
  const source = await readFile(bishopWizardPath, 'utf8')

  assert.match(source, /episcopal_ordination_date/)
  assert.match(source, /episcopal_role_type: episcopalRoleType/)
  assert.match(source, /canonical_status: canonicalStatus/)
  assert.match(source, /dignities,/)
  assert.match(source, /office_configuration_id/)
  assert.match(source, /source_checked_at/)
})
