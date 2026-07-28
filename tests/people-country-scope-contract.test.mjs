import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrationName = '20260728144957_scope_people_and_assignments_by_country.sql'

async function readMigration() {
  return readFile(new URL(`supabase/migrations/${migrationName}`, repoRoot), 'utf8')
}

test('repository keeps the exact applied people authorization migration', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))
  assert.equal(files.includes(migrationName), true)
})

test('person scope is projected from canonical ecclesial relationships', async () => {
  const migration = await readMigration()

  assert.match(migration, /function app_private\.person_scope_entities\(p_person_id uuid\)/)
  assert.match(migration, /position_assignments/)
  assert.match(migration, /organization_units/)
  assert.match(migration, /clergy_profiles/)
  assert.match(migration, /religious_profiles/)
  assert.match(migration, /episcopal_roles/)
  assert.match(migration, /clerical_incardinations/)
  assert.match(migration, /audit_logs/)
})

test('person management uses entity permission and reserves unscoped people for super admin', async () => {
  const migration = await readMigration()
  const start = migration.indexOf('function app_private.current_user_can_manage_person')
  const end = migration.indexOf('create or replace function', start + 30)
  const body = migration.slice(start, end)

  assert.match(body, /current_user_can_manage_entity\(p_permission_key, scope_row\.entity_id\)/)
  assert.match(body, /current_user_has_role\(array\['super_admin'\]\)/)
  assert.doesNotMatch(body, /national_admin/)
  assert.doesNotMatch(body, /current_user_is_super_or_national/)
  assert.doesNotMatch(body, /created_by = auth\.uid/)
})

test('people, profiles, ordinations and assignments use scoped read policies', async () => {
  const migration = await readMigration()

  assert.match(migration, /persons_select_anon_public/)
  assert.match(migration, /persons_select_authenticated_scoped/)
  assert.match(migration, /clergy_profiles_select_authenticated_scoped/)
  assert.match(migration, /religious_profiles_select_authenticated_scoped/)
  assert.match(migration, /ordination_events_select_authenticated_scoped/)
  assert.match(migration, /position_assignments_select_authenticated_scoped/)
  assert.match(migration, /current_user_can_read_person\(person_id\)/)
  assert.match(migration, /current_user_can_read_position_assignment\(id\)/)
  assert.doesNotMatch(migration, /create policy[\s\S]{0,180}current_user_has_admin_role/)
})

test('direct writes to religious profiles and ordinations are revoked', async () => {
  const migration = await readMigration()

  assert.match(migration, /revoke insert, update, delete on table public\.religious_profiles from authenticated/)
  assert.match(migration, /revoke insert, update, delete on table public\.ordination_events from authenticated/)
  assert.doesNotMatch(migration, /create policy religious_profiles[^;]*(insert|update|delete)/i)
  assert.doesNotMatch(migration, /create policy ordination_events[^;]*(insert|update|delete)/i)
})

test('canonical people writers fail closed on person and entity country', async () => {
  const migration = await readMigration()

  for (const functionName of [
    'rpc_definer__admin_mark_person_deceased',
    'rpc_definer__admin_save_position_assignment',
    'rpc_definer__admin_save_canonical_person',
  ]) {
    const start = migration.indexOf(`function app_private.${functionName}`)
    assert.notEqual(start, -1, `${functionName} must be defined`)
    const end = migration.indexOf('create or replace function', start + 30)
    const body = migration.slice(start, end === -1 ? migration.length : end)
    assert.doesNotMatch(body, /current_user_is_super_or_national/)
    assert.doesNotMatch(body, /current_user_has_scope_access/)
  }

  assert.match(migration, /La persona del nombramiento está fuera de tu alcance/)
  assert.match(migration, /La entidad del nombramiento está fuera de tu alcance/)
  assert.match(migration, /La entidad seleccionada está fuera de tu alcance/)
  assert.match(migration, /La persona está fuera de tu alcance/)
})

test('assignment writer validates organization unit, person, related assignments and audit scope', async () => {
  const migration = await readMigration()
  const start = migration.indexOf('function app_private.rpc_definer__admin_save_position_assignment')
  const end = migration.indexOf('create or replace function', start + 30)
  const body = migration.slice(start, end)

  assert.match(body, /v_unit_entity_id/)
  assert.match(body, /La entidad del nombramiento no coincide con la unidad organizativa/)
  assert.match(body, /current_user_can_manage_person\('appointments\.create_proposal', v_person_id\)/)
  assert.match(body, /review_record_scope_entity\('position_assignments', v_predecessor_id\)/)
  assert.match(body, /review_record_scope_entity\('position_assignments', v_successor_id\)/)
  assert.match(body, /perform public\.create_audit_log/)
  assert.match(body, /'scope_entity_id', v_entity_id/)
})

test('people candidate and import match readers use the person helper', async () => {
  const migration = await readMigration()

  assert.match(migration, /admin_list_unordained_people/)
  assert.match(migration, /current_user_can_manage_person\('people\.create_proposal', person_row\.id\)/)
  assert.match(migration, /import_person_matches/)
  assert.match(migration, /current_user_can_manage_person\('imports\.prepare', person_state\.id\)/)
})
