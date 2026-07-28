import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrations = {
  storage: '20260728202305_normalize_role_assignment_scope_storage.sql',
  authorization: '20260728202612_replace_legacy_scope_authorization_helpers.sql',
  facade: '20260728202801_restore_safe_current_user_can_facade.sql',
  nodeFix: '20260728203321_preserve_structure_node_entity_scopes.sql',
  labels: '20260728203435_expose_canonical_role_scope_labels.sql',
  rls: '20260728203626_remove_broad_national_rls_shortcuts.sql',
  catalogs: '20260728203749_simplify_access_catalog_read_policies.sql',
  rlsGrant: '20260728204636_grant_scoped_user_assignment_rls_helper.sql',
}

async function readMigration(fileName) {
  return readFile(new URL(`supabase/migrations/${fileName}`, repoRoot), 'utf8')
}

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`)
  assert.notEqual(start, -1, `${functionName} must exist`)
  const end = source.indexOf('create or replace function', start + functionName.length + 20)
  return source.slice(start, end === -1 ? source.length : end)
}

test('repository versions the complete canonical role scope migration sequence', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))
  for (const fileName of Object.values(migrations)) {
    assert.equal(files.includes(fileName), true, `${fileName} must be committed`)
  }
})

test('role assignments use dedicated foreign keys and a canonical scope vocabulary', async () => {
  const migration = await readMigration(migrations.storage)

  assert.match(migration, /add column if not exists structure_node_id uuid references public\.structure_nodes/)
  assert.match(migration, /user_role_assignments_structure_node_id_idx/)
  assert.match(migration, /'global','national','diocese','vicariate','zone','parish'/)
  assert.match(migration, /'pastoral_area','organization_unit','entity'/)
  assert.match(migration, /when 'pastoral_zone' then 'zone'/)
  assert.match(migration, /when 'pastoral_entity' then 'organization_unit'/)
  assert.match(migration, /when role_row\.key = 'super_admin' then 'global'/)
  assert.doesNotMatch(migration, /scope_type in \('national','ecclesiastical_province'/)
})

test('typed authorization rejects unscoped national access and separates nodes from entities', async () => {
  const migration = await readMigration(migrations.authorization)
  const dispatcher = functionBody(migration, 'app_private.current_user_can_manage_scope')
  const legacyScope = functionBody(migration, 'app_private.current_user_has_scope_access')

  assert.match(dispatcher, /current_user_can_manage_country/)
  assert.match(dispatcher, /current_user_can_manage_entity/)
  assert.match(dispatcher, /current_user_can_manage_structure_node/)
  assert.match(dispatcher, /current_user_can_manage_pastoral_area/)
  assert.match(dispatcher, /current_user_can_manage_organization_unit/)
  assert.match(dispatcher, /current_user_can_manage_person/)
  assert.match(dispatcher, /v_country_iso2 is not null/)
  assert.match(legacyScope, /assignment\.country_iso2=v_country_iso2/)
  assert.match(migration, /revoke execute on function public\.current_user_has_scope_access/)
})

test('the public compatibility facade delegates through the typed private dispatcher', async () => {
  const migration = await readMigration(migrations.facade)

  assert.match(migration, /create or replace function public\.current_user_can/)
  assert.match(migration, /security definer/)
  assert.match(migration, /current_user_can_manage_scope/)
  assert.match(migration, /revoke all on function public\.current_user_can.*public,anon/s)
  assert.match(migration, /grant execute on function public\.current_user_can.*authenticated/s)
  assert.doesNotMatch(migration, /current_user_has_scope_access/)
})

test('entity assignments backed by structure nodes preserve the canonical node id', async () => {
  const migration = await readMigration(migrations.nodeFix)
  const trigger = functionBody(migration, 'app_private.derive_role_assignment_country_context')

  assert.match(trigger, /v_scope_type = 'entity' and new\.structure_node_id is not null/)
  assert.match(trigger, /new\.scope_entity_id := coalesce\(v_node_entity_id, v_node_diocese_id\)/)
  assert.match(trigger, /new\.structure_node_id/)
  assert.doesNotMatch(
    trigger.slice(
      trigger.indexOf("v_scope_type = 'entity' and new.structure_node_id is not null"),
      trigger.indexOf("elsif v_scope_type = 'entity' then"),
    ),
    /new\.structure_node_id := null/,
  )
})

test('role payloads and onboarding expose canonical ids and human labels', async () => {
  const migration = await readMigration(migrations.labels)

  assert.match(migration, /function app_private\.role_assignment_scope_label/)
  assert.match(migration, /'scope_label',app_private\.role_assignment_scope_label/)
  assert.match(migration, /'structure_node_id',assignment\.structure_node_id/)
  assert.match(migration, /when 'organization_unit' then coalesce\(unit_row\.name/)
})

test('corrected RLS policies contain no broad national-admin shortcut', async () => {
  const migration = await readMigration(migrations.rls)
  const grant = await readMigration(migrations.rlsGrant)

  assert.match(migration, /current_user_can_manage_entity\('imports\.prepare'/)
  assert.match(migration, /current_user_can_manage_organization_unit\(/)
  assert.match(migration, /current_user_can_manage_user\(user_id\)/)
  assert.match(migration, /revoke insert,update,delete on table public\.user_role_assignments/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national|current_user_is_admin/)
  assert.match(grant, /grant execute on function app_private\.current_user_can_manage_user\(uuid\) to authenticated/)
  assert.doesNotMatch(grant, /grant (select|insert|update|delete)/)
})

test('navigation resolves each scope from its canonical identifier', async () => {
  const navigation = await readFile(
    new URL('src/features/admin/navigation/admin-navigation-service.ts', repoRoot),
    'utf8',
  )

  assert.match(navigation, /structure_node_id\?: string \| null/)
  assert.match(navigation, /function assignmentScopeId/)
  assert.match(navigation, /return assignment\.structure_node_id \?\? null/)
  assert.match(navigation, /return assignment\.organization_unit_id \?\? null/)
  assert.match(navigation, /return assignment\.pastoral_area_id \?\? null/)
  assert.match(navigation, /scope_entity_id,structure_node_id,country_iso2/)
  assert.doesNotMatch(navigation, /scopeType === 'national' && !countryIso2/)
})

test('access catalog read policies no longer invoke administrative role shortcuts', async () => {
  const migration = await readMigration(migrations.catalogs)

  assert.match(migration, /create policy roles_select_authenticated/)
  assert.match(migration, /create policy permissions_select_authenticated/)
  assert.match(migration, /create policy role_permissions_select_authenticated/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national/)
})
