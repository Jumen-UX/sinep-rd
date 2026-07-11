import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('assignment route delegates to the appointments feature', async () => {
  const route = await readRepoFile('src/app/(admin)/admin/asignaciones/page.tsx')
  const feature = await readRepoFile('src/features/appointments/index.ts')

  assert.equal(route.trim(), "export { AssignmentManagerPage as default } from '@/features/appointments'")
  assert.match(feature, /AssignmentManagerPage/)
  assert.match(feature, /assignment-admin-service/)
})

test('assignment manager reads canonical person state and validates before saving', async () => {
  const page = await readRepoFile('src/features/appointments/admin/AssignmentManagerPage.tsx')
  const service = await readRepoFile('src/features/appointments/services/assignment-admin-service.ts')

  assert.match(service, /from\('person_ecclesial_state'\)/)
  assert.match(service, /admin_check_position_assignment_eligibility/)
  assert.match(service, /required_ordination_degree/)
  assert.match(service, /holder_cardinality/)
  assert.doesNotMatch(service, /\.from\('persons'\)[\s\S]*?person_type/)
  assert.doesNotMatch(service, /\.eq\('person_type'/)

  assert.match(page, /checkAssignmentEligibility/)
  assert.match(page, /Titular único/)
  assert.match(page, /Cargo múltiple/)
  assert.match(page, /Cerrar únicamente la asignación vigente de esta misma persona/)
  assert.doesNotMatch(page, /\.from\(/)
  assert.doesNotMatch(page, /\.person_type/)
})

test('office configuration separates degree, episcopal role, clerical status and holder cardinality', async () => {
  const migration = await readRepoFile('supabase/migrations/20260710223355_canonical_office_eligibility_fields.sql')

  assert.match(migration, /required_ordination_degree/)
  assert.match(migration, /allowed_episcopal_role_types/)
  assert.match(migration, /allowed_clerical_statuses/)
  assert.match(migration, /holder_cardinality/)
  assert.match(migration, /max_current_holders/)
  assert.match(migration, /obispo_diocesano/)
  assert.match(migration, /obispo_auxiliar/)
  assert.match(migration, /vicario_parroquial/)
})

test('eligibility derives from ordination history instead of legacy person type', async () => {
  const migration = await readRepoFile('supabase/migrations/20260710223417_canonical_position_eligibility_engine.sql')

  assert.match(migration, /person_ecclesial_state/)
  assert.match(migration, /highest_ordination_degree/)
  assert.match(migration, /clerical_status_history/)
  assert.match(migration, /episcopal_roles/)
  assert.match(migration, /religious_profiles/)
  assert.match(migration, /episcopal_role_required/)
  assert.doesNotMatch(migration, /persons\.person_type/)
})

test('single and multiple holder offices use different replacement behavior', async () => {
  const cardinality = await readRepoFile('supabase/migrations/20260710223436_position_assignment_cardinality_rules.sql')
  const writer = await readRepoFile('supabase/migrations/20260710223502_canonical_position_assignment_writer.sql')
  const lock = await readRepoFile('supabase/migrations/20260710223640_replace_global_assignment_uniqueness_with_cardinality_lock.sql')

  assert.match(cardinality, /v_holder_cardinality='single'/)
  assert.match(cardinality, /La persona ya tiene este cargo vigente en la misma entidad/)
  assert.match(cardinality, /create constraint trigger position_assignments_canonical_eligibility/)
  assert.match(cardinality, /deferrable initially deferred/)

  assert.match(writer, /v_holder_cardinality='single'/)
  assert.match(writer, /v_close_previous and v_person_id is not null/)
  assert.match(writer, /closed_previous_current_count/)

  assert.match(lock, /drop index if exists public\.uniq_position_assignments_current_scope/)
  assert.match(lock, /pg_advisory_xact_lock/)
  assert.match(lock, /position_assignments_current_scope_idx/)
})
