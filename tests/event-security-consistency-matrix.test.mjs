import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const compensationMigration = fs.readFileSync(
  new URL('../supabase/migrations/20260716024500_harden_compensation_concurrency_and_grants.sql', import.meta.url),
  'utf8',
)

const applicationMigration = fs.readFileSync(
  new URL('../supabase/migrations/20260716003000_harden_idempotent_event_application.sql', import.meta.url),
  'utf8',
)

const timelineMigration = fs.readFileSync(
  new URL('../supabase/migrations/20260716013000_project_canonical_institutional_timeline.sql', import.meta.url),
  'utf8',
)

test('compensation RPC is restricted and concurrency-safe', () => {
  assert.match(compensationMigration, /revoke all on function public\.admin_create_compensating_event\(jsonb\) from public, anon/i)
  assert.match(compensationMigration, /grant execute on function public\.admin_create_compensating_event\(jsonb\) to authenticated/i)
  assert.match(compensationMigration, /for update of ce/i)
  assert.match(compensationMigration, /unique_violation/i)
  assert.match(compensationMigration, /active_compensation_already_exists/i)
})

test('application remains serialized and idempotent', () => {
  assert.match(applicationMigration, /where ce\.id = v_event_id\s+for update/i)
  assert.match(applicationMigration, /idempotent_replay/i)
  assert.match(applicationMigration, /event_action_dependency_missing/i)
  assert.match(applicationMigration, /event_action_dependency_not_applied/i)
  assert.match(applicationMigration, /order by sort_order, id/i)
})

test('state reconstruction remains a stable read-only contract', () => {
  assert.match(timelineMigration, /create or replace function public\.get_institutional_state_reconstruction/i)
  assert.match(timelineMigration, /language sql\s+stable/i)
  assert.doesNotMatch(timelineMigration, /security definer/i)
})
