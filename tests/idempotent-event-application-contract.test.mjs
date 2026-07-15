import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('organization event application is serialized and idempotent', async () => {
  const migration = await readRepoFile('supabase/migrations/20260716003000_harden_idempotent_event_application.sql')

  assert.match(migration, /where ce\.id = v_event_id\s+for update/)
  assert.match(migration, /if v_event\.status = 'applied' then/)
  assert.match(migration, /'idempotent_replay', true/)
  assert.match(migration, /'idempotent_replay', false/)
  assert.match(migration, /order by sort_order, id\s+for update/)
  assert.match(migration, /event_action_dependency_missing/)
  assert.match(migration, /event_action_dependency_not_applied/)
})

test('application preserves transaction audit and privileged boundaries', async () => {
  const migration = await readRepoFile('supabase/migrations/20260716003000_harden_idempotent_event_application.sql')

  assert.match(migration, /events\.organization_unit\.apply_replayed/)
  assert.match(migration, /events\.organization_unit\.applied/)
  assert.match(migration, /current_user_has_permission\('events\.apply'\)/)
  assert.match(migration, /current_user_can_manage_entity\('events\.apply'/)
  assert.match(migration, /revoke all on function internal\.admin_apply_organization_unit_event\(jsonb\) from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.admin_apply_organization_unit_event\(jsonb\) to authenticated/)
})

test('application supports only explicitly implemented organizational actions', async () => {
  const migration = await readRepoFile('supabase/migrations/20260716003000_harden_idempotent_event_application.sql')

  for (const action of [
    'create_organization_unit',
    'move_organization_unit',
    'update_organization_unit_status',
    'publish_organization_unit',
    'update_organization_unit_validity',
  ]) {
    assert.match(migration, new RegExp(action))
  }

  assert.match(migration, /unsupported_organization_unit_action/)
  assert.doesNotMatch(migration, /admin_apply_entity_event/)
})
