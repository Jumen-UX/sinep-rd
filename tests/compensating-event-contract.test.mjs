import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('compensating events preserve applied history and create a linked draft', async () => {
  const migration = await readRepoFile('supabase/migrations/20260716021500_add_compensating_event_contract.sql')

  assert.match(migration, /compensates_event_id uuid references public\.canonical_events\(id\)/)
  assert.match(migration, /compensation_reason text/)
  assert.match(migration, /correction_kind in \('reversal','correction','supersession'\)/)
  assert.match(migration, /where compensates_event_id is not null and status <> 'cancelled'/)
  assert.match(migration, /if v_original\.status <> 'applied'/)
  assert.match(migration, /if not v_original\.is_compensable/)
  assert.match(migration, /'draft',auth\.uid\(\)/)
  assert.match(migration, /cep\.after_state,cep\.before_state/)
  assert.match(migration, /applied_event_cannot_be_deleted/)
  assert.match(migration, /applied_event_is_immutable_create_compensation/)
  assert.match(migration, /events\.compensation\.created/)
})

test('compensation service validates the correction before invoking the RPC', async () => {
  const service = await readRepoFile('src/features/events/services/event-compensation-admin-service.ts')

  assert.match(service, /export type CompensationKind = 'reversal' \| 'correction' \| 'supersession'/)
  assert.match(service, /El motivo de la corrección es obligatorio/)
  assert.match(service, /El evento original es obligatorio/)
  assert.match(service, /admin_create_compensating_event/)
  assert.match(service, /effective_date: input\.effectiveDate \|\| input\.eventDate/)
})
