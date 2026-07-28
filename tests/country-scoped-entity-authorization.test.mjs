import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrations = {
  publicContracts: '20260728134017_create_public_entity_read_contracts.sql',
  scopedReads: '20260728134425_scope_entity_reads_and_relationships.sql',
  strictBooleans: '20260728134625_normalize_service_role_boolean_helpers.sql',
  columnGrants: '20260728134752_restrict_public_entity_base_columns.sql',
}

async function readMigration(fileName) {
  return readFile(new URL(`supabase/migrations/${fileName}`, repoRoot), 'utf8')
}

test('repository keeps the exact applied entity authorization migration sequence', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))

  for (const fileName of Object.values(migrations)) {
    assert.equal(files.includes(fileName), true, `${fileName} must be committed`)
  }
})

test('public entity API uses sanitized views and excludes relationship notes', async () => {
  const route = await readFile(new URL('src/app/api/entidades/route.ts', repoRoot), 'utf8')

  assert.match(route, /public_entity_directory_details/)
  assert.match(route, /public_entity_relationships/)
  assert.doesNotMatch(route, /fetchSupabaseJson<Record<string, unknown>\[]>\('ecclesiastical_entities'/)
  assert.doesNotMatch(route, /fetchSupabaseJson<Record<string, unknown>\[]>\('entity_relationships'/)
  assert.doesNotMatch(route, /'notes'/)
})

test('public entity contracts are security-invoker and omit workflow metadata', async () => {
  const migration = await readMigration(migrations.publicContracts)

  assert.match(migration, /public_entity_directory_details/)
  assert.match(migration, /public_entity_relationships/)
  assert.match(migration, /with \(security_invoker = true\)/)
  assert.match(migration, /entity_row\.status = 'active'/)
  assert.match(migration, /entity_row\.visibility = 'public'/)
  assert.doesNotMatch(migration, /relationship_row\.notes/)
  assert.doesNotMatch(migration, /relationship_row\.document_id/)
  assert.doesNotMatch(migration, /relationship_row\.approved_change_request_id/)
})

test('entity and relationship RLS use territorial readers and revoke direct writes', async () => {
  const migration = await readMigration(migrations.scopedReads)

  assert.match(migration, /current_user_can_read_entity\(p_entity_id uuid\)/)
  assert.match(migration, /current_user_can_read_entity_relationship\(p_relationship_id uuid\)/)
  assert.match(migration, /current_user_can_manage_entity\('entities\.view', entity_row\.id\)/)
  assert.match(migration, /ecclesiastical_entities_select_scoped/)
  assert.match(migration, /entity_relationships_select_scoped/)
  assert.match(migration, /revoke insert, update, delete on table public\.entity_relationships from authenticated/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national/)
  assert.doesNotMatch(migration, /current_user_has_any_active_role/)
})

test('authorization helpers return strict booleans when service-role claim is absent', async () => {
  const migration = await readMigration(migrations.strictBooleans)
  const strictServiceRoleChecks = migration.match(
    /coalesce\(current_setting\('request\.jwt\.claim\.role', true\) = 'service_role', false\)/g,
  ) ?? []

  assert.equal(strictServiceRoleChecks.length, 3)
  assert.match(migration, /current_user_can_access_country/)
  assert.match(migration, /current_user_can_manage_user/)
  assert.match(migration, /current_user_can_read_entity_descendants/)
})

test('anonymous access is column-scoped on entity base tables', async () => {
  const migration = await readMigration(migrations.columnGrants)

  assert.match(migration, /revoke select on table public\.ecclesiastical_entities from anon/)
  assert.match(migration, /revoke select on table public\.entity_relationships from anon/)
  assert.match(migration, /grant select \([\s\S]*source_checked_at[\s\S]*\) on table public\.ecclesiastical_entities to anon/)
  assert.match(migration, /grant select \([\s\S]*created_at[\s\S]*\) on table public\.entity_relationships to anon/)
  assert.doesNotMatch(migration, /grant select \([\s\S]*notes[\s\S]*\) on table public\.entity_relationships to anon/)
  assert.doesNotMatch(migration, /grant select \([\s\S]*created_by[\s\S]*\) on table public\.ecclesiastical_entities to anon/)
})
