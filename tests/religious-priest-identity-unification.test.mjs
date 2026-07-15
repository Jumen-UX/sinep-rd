import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('diocesan and religious priests share the canonical priest registration flow', async () => {
  const wizard = await readRepoFile('src/features/clero/priest/admin/PriestWizardPage.tsx')
  const service = await readRepoFile('src/features/clero/priest/services/priest-admin-service.ts')
  const religiousWizard = await readRepoFile('src/features/vida-consagrada/religious/admin/ReligiousWizardPage.tsx')

  assert.match(wizard, /priestType === 'diocesan'/)
  assert.match(wizard, /priestType === 'religious'/)
  assert.match(wizard, /existing_deacon_person_id: existingDeaconId \|\| null/)
  assert.match(wizard, /religious_institute_name: religiousInstituteName/)
  assert.match(wizard, /religious_order: religiousInstituteName/)
  assert.match(service, /saveCanonicalPersonRegistration\('priest'/)
  assert.match(service, /selected_person_id: selectedPersonId/)
  assert.match(religiousWizard, /router\.push\('\/admin\/nuevo\/sacerdote'\)/)
  assert.doesNotMatch(religiousWizard, /saveCanonicalPersonRegistration\('priest'/)
})

test('religious priest registration updates one person, clergy profile and religious profile', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260710220313_unified_canonical_person_registration_engine.sql',
  )

  assert.match(migration, /v_selected_person_id uuid := coalesce\([\s\S]*?existing_deacon_person_id/)
  assert.match(migration, /if v_mode = 'existing' then[\s\S]*?where p\.id = v_selected_person_id[\s\S]*?for update;/)
  assert.match(migration, /v_flow = 'priest' and \(not v_has_diaconate or v_has_presbyterate or v_has_episcopate\)/)
  assert.match(migration, /insert into public\.ordination_events[\s\S]*?'presbyterate'/)
  assert.match(migration, /insert into public\.clergy_profiles[\s\S]*?on conflict \(person_id\) do update/)
  assert.match(migration, /if v_flow = 'religious' or v_priest_type = 'religious'/)
  assert.match(migration, /insert into public\.religious_profiles[\s\S]*?on conflict \(person_id\) do update/)
  assert.match(migration, /case when v_priest_type = 'religious' then 'religious_institute' else 'diocesan' end/)
  assert.match(migration, /'person_id', v_person_id/)

  assert.doesNotMatch(migration, /insert into public\.persons[\s\S]*?v_flow = 'religious'[\s\S]*?v_flow = 'priest'/)
})
