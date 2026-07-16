import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const revisionMigration = fs.readFileSync(
  new URL('../supabase/migrations/20260716032000_replace_compensation_with_event_revisions.sql', import.meta.url),
  'utf8',
)

const historyMigration = fs.readFileSync(
  new URL('../supabase/migrations/20260716033000_expose_event_revision_history.sql', import.meta.url),
  'utf8',
)

test('event corrections require permission, scope and row serialization', () => {
  assert.match(revisionMigration, /current_user_has_permission\('events\.approve'\)/i)
  assert.match(revisionMigration, /current_user_is_super_or_national\(\)/i)
  assert.match(revisionMigration, /current_user_can_manage_entity\('events\.approve',\s*v_scope_entity_id\)/i)
  assert.match(revisionMigration, /evento est[aá] fuera de tu alcance/i)
  assert.match(revisionMigration, /for update/i)
  assert.match(revisionMigration, /canonical_event_revisions_event_revision_number_key/i)
  assert.match(revisionMigration, /events\.corrected/i)
})

test('revision history is administrative and scope restricted', () => {
  assert.match(historyMigration, /current_user_has_permission\('events\.approve'\)/i)
  assert.match(historyMigration, /current_user_is_super_or_national\(\)/i)
  assert.match(historyMigration, /current_user_can_manage_entity\('events\.approve',\s*v_scope_entity_id\)/i)
  assert.match(historyMigration, /revoke all on function public\.get_event_revision_history\(uuid\) from public, anon/i)
  assert.match(historyMigration, /grant execute on function public\.get_event_revision_history\(uuid\) to authenticated/i)
  assert.match(historyMigration, /order by cer\.revision_number desc/i)
})
