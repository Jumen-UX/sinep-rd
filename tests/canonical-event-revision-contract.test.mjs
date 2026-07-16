import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('event corrections update the same event and preserve before and after states', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260716032000_replace_compensation_with_event_revisions.sql',
  )

  assert.match(migration, /create table if not exists public\.canonical_event_revisions/)
  assert.match(migration, /before_state jsonb not null/)
  assert.match(migration, /after_state jsonb not null/)
  assert.match(migration, /changed_fields text\[\]/)
  assert.match(migration, /change_reason text not null/)
  assert.match(migration, /changed_by uuid references auth\.users/)
  assert.match(migration, /where id = v_event_id\s+for update/i)
  assert.match(migration, /events\.corrected/)
  assert.match(migration, /applied_event_requires_audited_correction/)
  assert.doesNotMatch(migration, /insert into public\.canonical_events[\s\S]*compensates_event_id/)
})

test('event correction service validates changes before invoking the RPC', async () => {
  const service = await readRepoFile(
    'src/features/events/services/event-correction-admin-service.ts',
  )

  assert.match(service, /El motivo de la corrección es obligatorio/)
  assert.match(service, /Debes indicar al menos un campo para corregir/)
  assert.match(service, /admin_correct_canonical_event/)
  assert.match(service, /revision_number/)
  assert.match(service, /before_state/)
  assert.match(service, /after_state/)
})
