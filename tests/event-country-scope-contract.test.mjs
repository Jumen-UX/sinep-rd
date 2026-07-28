import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrationName = '20260728143037_scope_event_workflows_by_country.sql'

async function readMigration() {
  return readFile(new URL(`supabase/migrations/${migrationName}`, repoRoot), 'utf8')
}

test('repository keeps the exact applied event workflow migration', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))
  assert.equal(files.includes(migrationName), true)
})

test('canonical event helpers resolve permission through canonical entity scope', async () => {
  const migration = await readMigration()

  assert.match(migration, /current_user_can_manage_canonical_event\([\s\S]*p_permission_key text[\s\S]*p_event_id uuid/)
  assert.match(migration, /canonical_event_scope_entity_id\(p_event_id\)/)
  assert.match(migration, /current_user_can_manage_entity\(p_permission_key, v_scope_entity_id\)/)
  assert.match(migration, /current_user_has_role\(array\['super_admin'\]\)/)
})

test('all migrated canonical event writers use the shared country helper', async () => {
  const migration = await readMigration()
  const protectedWriters = [
    'rpc_definer__admin_generate_event_action_plan',
    'rpc_definer__admin_review_event',
    'rpc_definer__admin_approve_event',
    'rpc_definer__admin_configure_event_action',
    'rpc_definer__admin_update_event_action',
    'rpc_definer__admin_correct_canonical_event',
  ]

  for (const functionName of protectedWriters) {
    const start = migration.indexOf(`function app_private.${functionName}`)
    assert.notEqual(start, -1, `${functionName} must be defined`)
    const nextFunction = migration.indexOf('create or replace function', start + 20)
    const body = migration.slice(start, nextFunction === -1 ? migration.length : nextFunction)
    assert.match(body, /current_user_can_manage_canonical_event/)
    assert.doesNotMatch(body, /current_user_is_super_or_national/)
  }
})

test('event RLS is country-scoped instead of global admin-role scoped', async () => {
  const migration = await readMigration()

  assert.match(migration, /canonical_events_select_authenticated_scoped/)
  assert.match(migration, /canonical_event_actions_select_scoped/)
  assert.match(migration, /canonical_event_participants_select_authenticated_scoped/)
  assert.match(migration, /structure_events_select_scoped/)
  assert.match(migration, /structure_event_actions_select_scoped/)
  assert.match(migration, /structure_event_nodes_select_scoped/)
  assert.doesNotMatch(migration, /create policy[\s\S]{0,180}current_user_has_admin_role/)
})

test('event mutations are RPC-only for authenticated clients', async () => {
  const migration = await readMigration()

  for (const tableName of [
    'canonical_event_actions',
    'canonical_event_participants',
    'structure_events',
    'structure_event_actions',
    'structure_event_nodes',
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke insert, update, delete on table public\\.${tableName} from authenticated`),
    )
  }
})

test('structural workflow is not exposed to anonymous clients', async () => {
  const migration = await readMigration()

  assert.match(migration, /revoke select on table public\.structure_events from anon/)
  assert.match(migration, /revoke select on table public\.structure_event_actions from anon/)
  assert.match(migration, /revoke select on table public\.structure_event_nodes from anon/)
  assert.doesNotMatch(migration, /create policy structure_events[^;]*to anon/i)
})

test('public canonical event columns exclude workflow actors and participant snapshots', async () => {
  const migration = await readMigration()

  assert.match(migration, /revoke select on table public\.canonical_events from anon/)
  assert.match(migration, /grant select \([\s\S]*notes_json[\s\S]*\) on table public\.canonical_events to anon/)
  assert.doesNotMatch(migration, /grant select \([\s\S]*created_by[\s\S]*\) on table public\.canonical_events to anon/)
  assert.doesNotMatch(migration, /grant select \([\s\S]*approved_by[\s\S]*\) on table public\.canonical_events to anon/)
  assert.doesNotMatch(migration, /grant select \([\s\S]*before_state[\s\S]*\)\s*on table public\.canonical_event_participants to anon/)
  assert.doesNotMatch(migration, /grant select \([\s\S]*after_state[\s\S]*\)\s*on table public\.canonical_event_participants to anon/)
})
