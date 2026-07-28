import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrations = {
  scope: '20260728150859_scope_people_imports_and_diagnostics_by_country.sql',
  dispatcher: '20260728151123_fix_import_application_rpc_chain.sql',
  diagnostics: '20260728151455_fix_people_diagnostic_rpc_chain.sql',
  diagnosticPermission: '20260728151551_align_missing_clergy_diagnostic_permission.sql',
  orphanOwner: '20260728151646_fix_orphan_photo_owner_type.sql',
}

async function readMigration(fileName) {
  return readFile(new URL(`supabase/migrations/${fileName}`, repoRoot), 'utf8')
}

test('repository keeps the exact applied people import migration sequence', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))
  for (const fileName of Object.values(migrations)) {
    assert.equal(files.includes(fileName), true, `${fileName} must be committed`)
  }
})

test('person and assignment import engines are sealed behind scoped facades', async () => {
  const migration = await readMigration(migrations.scope)

  assert.match(migration, /rename to admin_apply_person_import_batch_unscoped/)
  assert.match(migration, /rename to admin_apply_assignment_import_batch_unscoped/)
  assert.match(migration, /revoke all on function app_private\.admin_apply_person_import_batch_unscoped/)
  assert.match(migration, /revoke all on function app_private\.admin_apply_assignment_import_batch_unscoped/)
  assert.match(migration, /current_user_can_manage_entity\('imports\.apply', v_batch\.scope_entity_id\)/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national/)
})

test('every imported person row remains inside the batch country and entity permission', async () => {
  const migration = await readMigration(migrations.scope)
  const start = migration.indexOf('function app_private.admin_apply_person_import_batch')
  const end = migration.indexOf('create or replace function', start + 30)
  const body = migration.slice(start, end)

  assert.match(body, /resolve_entity_country_iso2\(v_batch\.scope_entity_id\)/)
  assert.match(body, /resolve_entity_country_iso2\(v_row_entity_id\)/)
  assert.match(body, /v_row_country is distinct from v_batch_country/)
  assert.match(body, /current_user_can_manage_entity\('people\.create_proposal', v_row_entity_id\)/)
})

test('every imported assignment validates country, entity and person', async () => {
  const migration = await readMigration(migrations.scope)
  const start = migration.indexOf('function app_private.admin_apply_assignment_import_batch')
  const end = migration.indexOf('create or replace function', start + 30)
  const body = migration.slice(start, end)

  assert.match(body, /audit_json_uuid\(v_row\.resolved_relations, 'persona'\)/)
  assert.match(body, /audit_json_uuid\(v_row\.resolved_relations, 'entidad'\)/)
  assert.match(body, /v_row_country is distinct from v_batch_country/)
  assert.match(body, /current_user_can_manage_entity\('appointments\.create_proposal', v_row_entity_id\)/)
  assert.match(body, /current_user_can_manage_person\('appointments\.create_proposal', v_row_person_id\)/)
})

test('public import dispatcher is a sealed definer and requires canonical batch scope', async () => {
  const migration = await readMigration(migrations.dispatcher)

  assert.match(migration, /function app_private\.admin_apply_import_batch/)
  assert.match(migration, /current_user_has_permission\('imports\.apply'\)/)
  assert.match(migration, /current_user_can_manage_entity\('imports\.apply', v_scope_entity_id\)/)
  assert.match(migration, /function public\.admin_apply_import_batch/)
  assert.match(migration, /language sql\s+security definer/)
  assert.match(migration, /grant execute on function public\.admin_apply_import_batch\(jsonb\) to authenticated/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national/)
})

test('assignment incompatibility resolution is scoped and audited', async () => {
  const migration = await readMigration(migrations.scope)
  const start = migration.indexOf('function app_private.rpc_definer__resolve_assignment_canonical_incompatibility')
  const end = migration.indexOf('create or replace function', start + 30)
  const body = migration.slice(start, end)

  assert.match(body, /review_record_scope_entity\('position_assignments', v_assignment_id\)/)
  assert.match(body, /current_user_can_manage_entity\('appointments\.approve', v_entity_id\)/)
  assert.match(body, /perform public\.create_audit_log/)
  assert.doesNotMatch(body, /current_user_is_super_or_national/)
})

test('people diagnostics use sealed RPCs and country-scoped people view', async () => {
  const chain = await readMigration(migrations.diagnostics)
  const permission = await readMigration(migrations.diagnosticPermission)

  assert.match(chain, /function public\.admin_count_missing_clergy_profiles/)
  assert.match(chain, /language sql\s+stable\s+security definer/)
  assert.match(chain, /function public\.admin_list_orphan_person_photos/)
  assert.match(permission, /current_user_can_manage_person\('people\.view', ordination\.person_id\)/)
  assert.doesNotMatch(permission, /people\.view_private/)
  assert.doesNotMatch(permission, /current_user_is_super_or_national/)
})

test('orphan photo inventory is super-admin-only and normalizes text owner ids safely', async () => {
  const scope = await readMigration(migrations.scope)
  const ownerFix = await readMigration(migrations.orphanOwner)

  assert.match(scope, /current_user_has_role\(array\['super_admin'\]\)/)
  assert.match(scope, /Solo un superadministrador puede revisar fotografías huérfanas/)
  assert.match(ownerFix, /object_row\.owner_id::uuid/)
  assert.match(ownerFix, /else null::uuid/)
  assert.match(ownerFix, /\^\[0-9a-f\]\{8\}/)
})
