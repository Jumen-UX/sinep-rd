import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('bishop route delegates to the clergy feature domain', async () => {
  const route = await readRepoFile('src/app/(admin)/admin/nuevo/obispo/page.tsx')
  const featureIndex = await readRepoFile('src/features/clero/bishop/index.ts')

  assert.equal(route.trim(), "export { BishopWizardPage as default } from '@/features/clero/bishop'")
  assert.match(featureIndex, /BishopWizardPage/)
  assert.match(featureIndex, /bishop-admin-service/)
})

test('bishop wizard delegates persistence and scoped catalogs to typed services', async () => {
  const page = await readRepoFile('src/features/clero/bishop/admin/BishopWizardPage.tsx')

  for (const operation of ['loadBishopCatalogs', 'loadAllowedOfficeIds', 'saveBishop']) {
    assert.match(page, new RegExp(operation))
  }

  assert.doesNotMatch(page, /\.from\(/)
  assert.doesNotMatch(page, /fetch\('/)
  assert.match(page, /Este nivel no tiene cargos configurados/)
  assert.match(page, /offices\.filter\(\(office\) => allowedOfficeIds\.includes\(office\.id\)\)/)
})

test('bishop wizard keeps every step mounted so final FormData contains prior fields', async () => {
  const page = await readRepoFile('src/features/clero/bishop/admin/BishopWizardPage.tsx')
  const mountedSteps = page.match(/<section hidden=\{step !== [0-4]\}>/g) ?? []

  assert.equal(mountedSteps.length, 5)
  assert.doesNotMatch(page, /\{step === [0-4] && \(/)
  assert.match(page, /new FormData\(event\.currentTarget\)/)
})

test('bishop candidates are derived from sacramental ordination state', async () => {
  const page = await readRepoFile('src/features/clero/bishop/admin/BishopWizardPage.tsx')
  const service = await readRepoFile('src/features/clero/bishop/services/bishop-admin-service.ts')

  assert.match(service, /loadClergyPlacementCatalogs/)
  assert.match(service, /loadAllowedOfficeIds/)
  assert.match(service, /loadCanonicalRegistrationCandidates\(supabase, 'bishop'\)/)
  assert.match(service, /from\('person_ecclesial_state'\)/)
  assert.match(service, /eq\('has_episcopate', true\)/)
  assert.doesNotMatch(service, /person_type/)
  assert.match(page, /highest_ordination_degree === 'presbyterate'/)
  assert.match(page, /highest_ordination_degree === 'episcopate'/)
  assert.doesNotMatch(page, /record\.person_type/)
  assert.match(service, /saveCanonicalPersonRegistration\('bishop'/)
})

test('bishop wizard separates sacrament role status dignity and appointment', async () => {
  const page = await readRepoFile('src/features/clero/bishop/admin/BishopWizardPage.tsx')
  const service = await readRepoFile('src/features/clero/bishop/services/bishop-admin-service.ts')

  assert.match(service, /export type BishopRoleType/)
  assert.match(service, /export type ClericalStatusType/)
  assert.match(service, /export type EcclesiasticalDignity/)
  assert.match(page, /episcopal_role_type: episcopalRoleType/)
  assert.match(page, /canonical_status: canonicalStatus/)
  assert.match(page, /dignities,/)
  assert.match(page, /title_see_name:/)
  assert.match(page, /Función, estado, dignidades y cargo/)
  assert.match(page, /no son grados adicionales del Orden/)
  assert.match(page, /Obispo coadjutor — con derecho de sucesión/)
  assert.match(page, /Título público del nombramiento/)
})

test('canonical engine records bishop dimensions and keeps legacy API compatible', async () => {
  const migration = await readRepoFile('supabase/migrations/20260710220313_unified_canonical_person_registration_engine.sql')
  const route = await readRepoFile('src/app/api/admin/obispo/route.ts')

  assert.match(migration, /insert into public\.ordination_events/)
  assert.match(migration, /insert into public\.episcopal_roles/)
  assert.match(migration, /insert into public\.person_ecclesiastical_dignities/)
  assert.match(migration, /create or replace function public\.admin_save_bishop/)
  assert.match(route, /allowedEpiscopalRoles/)
  assert.match(route, /allowedCanonicalStatuses/)
  assert.match(route, /allowedDignities/)
})
