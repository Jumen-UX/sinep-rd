import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('deacon route delegates to the clergy feature domain', async () => {
  const route = await readRepoFile('src/app/(admin)/admin/nuevo/diacono/page.tsx')
  const featureIndex = await readRepoFile('src/features/clero/deacon/index.ts')

  assert.equal(route.trim(), "export { DeaconWizardPage as default } from '@/features/clero/deacon'")
  assert.match(featureIndex, /DeaconWizardPage/)
  assert.match(featureIndex, /deacon-admin-service/)
})

test('deacon wizard delegates persistence and catalog reads to typed services', async () => {
  const page = await readRepoFile('src/features/clero/deacon/admin/DeaconWizardPage.tsx')

  for (const operation of [
    'loadDeaconCatalogs',
    'loadAllowedOfficeIds',
    'uploadDeaconPhoto',
    'removeDeaconPhoto',
    'saveDeacon',
  ]) {
    assert.match(page, new RegExp(operation))
  }

  assert.doesNotMatch(page, /\.from\(/)
  assert.doesNotMatch(page, /\.storage\./)
  assert.doesNotMatch(page, /fetch\('/)
  assert.match(page, /Este nivel no tiene cargos configurados/)
})

test('deacon flow reuses an existing unordained person identity', async () => {
  const page = await readRepoFile('src/features/clero/deacon/admin/DeaconWizardPage.tsx')
  const service = await readRepoFile('src/features/clero/deacon/services/deacon-admin-service.ts')

  assert.match(service, /loadCanonicalRegistrationCandidates\(supabase, 'deacon'\)/)
  assert.match(service, /saveCanonicalPersonRegistration\('deacon'/)
  assert.doesNotMatch(service, /person_type/)

  assert.match(page, /mode, setMode.*'existing'/)
  assert.match(page, /selected_person_id/)
  assert.match(page, /Añadir el diaconado a una persona existente/)
  assert.match(page, /sin duplicar su identidad/)
  assert.match(page, /const formElement = event\.currentTarget/)
})

test('deacon transaction preserves the person and records canonical diaconate', async () => {
  const migration = await readRepoFile('supabase/migrations/20260710220313_unified_canonical_person_registration_engine.sql')

  assert.match(migration, /v_mode text := lower\(coalesce/)
  assert.match(migration, /v_selected_person_id/)
  assert.match(migration, /from public\.ordination_events oe/)
  assert.match(migration, /insert into public\.ordination_events/)
  assert.match(migration, /'diaconate'/)
  assert.match(migration, /canonical_registration_engine/)
  assert.match(migration, /'layperson'/)
  assert.doesNotMatch(migration, /set\s+person_type\s*=/i)
})

test('canonical registration candidates and writes are constrained by user scope', async () => {
  const candidateMigration = await readRepoFile('supabase/migrations/20260710220418_unified_canonical_registration_candidates.sql')
  const engineMigration = await readRepoFile('supabase/migrations/20260710220313_unified_canonical_person_registration_engine.sql')

  assert.match(candidateMigration, /current_user_can_manage_person/)
  assert.match(candidateMigration, /admin_list_canonical_registration_candidates/)
  assert.match(candidateMigration, /not pes\.has_diaconate/)
  assert.match(engineMigration, /current_user_can_manage_person/)
  assert.match(engineMigration, /current_user_can_manage_entity/)
  assert.match(engineMigration, /La persona seleccionada está fuera de tu alcance/)
  assert.doesNotMatch(candidateMigration, /to anon/)
})

test('person placement service centralizes entity, office, level and photo infrastructure', async () => {
  const shared = await readRepoFile('src/features/personas/shared/services/person-placement-service.ts')
  const clergyBridge = await readRepoFile('src/features/clero/shared/services/clergy-admin-service.ts')
  const deacon = await readRepoFile('src/features/clero/deacon/services/deacon-admin-service.ts')
  const priest = await readRepoFile('src/features/clero/priest/services/priest-admin-service.ts')

  assert.match(shared, /from\('admin_entity_hierarchy_selector'\)/)
  assert.match(shared, /from\('office_configurations'\)/)
  assert.match(shared, /from\('structure_level_office_configurations'\)/)
  assert.match(shared, /const PHOTO_BUCKET = 'person-photos'/)
  assert.match(clergyBridge, /loadPersonPlacementCatalogs as loadClergyPlacementCatalogs/)

  assert.match(deacon, /loadClergyPlacementCatalogs/)
  assert.match(deacon, /uploadClergyPhoto/)
  assert.match(deacon, /saveCanonicalPersonRegistration/)

  assert.match(priest, /loadClergyPlacementCatalogs/)
  assert.match(priest, /uploadClergyPhoto/)
  assert.match(priest, /saveCanonicalPersonRegistration/)
  assert.doesNotMatch(priest, /from\('admin_entity_hierarchy_selector'\)/)
  assert.doesNotMatch(priest, /storage\.from\(PHOTO_BUCKET\)/)
})
