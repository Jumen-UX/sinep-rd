import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const revisionMigration = fs.readFileSync(
  new URL('../supabase/migrations/20260716032000_replace_compensation_with_event_revisions.sql', import.meta.url),
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

test('event correction RPC is restricted, serialized and audited', () => {
  assert.match(revisionMigration, /revoke all on function public\.admin_correct_canonical_event\(jsonb\) from public,anon/i)
  assert.match(revisionMigration, /grant execute on function public\.admin_correct_canonical_event\(jsonb\) to authenticated/i)
  assert.match(revisionMigration, /where id = v_event_id\s+for update/i)
  assert.match(revisionMigration, /canonical_event_revisions_unique_number unique/)
  assert.match(revisionMigration, /events\.corrected/)
  assert.match(revisionMigration, /unsupported_event_correction_field/)
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
