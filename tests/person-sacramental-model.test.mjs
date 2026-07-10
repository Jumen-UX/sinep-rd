import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('ordination events are the canonical cumulative sacramental history', async () => {
  const migration = await readRepoFile('supabase/migrations/20260710200732_canonical_person_ordination_events_core.sql')

  assert.match(migration, /create table public\.ordination_events/)
  assert.match(migration, /degree in \('diaconate', 'presbyterate', 'episcopate'\)/)
  assert.match(migration, /unique \(person_id, degree\)/)
  assert.match(migration, /create view public\.person_ecclesial_state/)
  assert.match(migration, /security_invoker = true/)
  assert.match(migration, /highest_ordination_degree/)
  assert.match(migration, /ecclesial_condition/)
  assert.match(migration, /Fuente canónica del historial del sacramento del Orden/)
})

test('legacy clergy writes synchronize into canonical ordination events', async () => {
  const migration = await readRepoFile('supabase/migrations/20260710200800_sync_legacy_clergy_writes_to_ordination_events.sql')

  assert.match(migration, /clergy_profiles_sync_ordination_events/)
  assert.match(migration, /episcopal_ordinations_sync_canonical_event/)
  assert.match(migration, /ordination_events_sync_person_legacy_type/)
  assert.match(migration, /when 'episcopate' then 'bishop'/)
  assert.match(migration, /when 'presbyterate' then 'priest'/)
  assert.match(migration, /when 'diaconate' then 'deacon'/)
})

test('higher ordinations create prerequisites and enforce chronological order', async () => {
  const migration = await readRepoFile('supabase/migrations/20260710201325_enforce_cumulative_ordination_sequence.sql')

  assert.match(migration, /new\.degree in \('presbyterate', 'episcopate'\)/)
  assert.match(migration, /new\.degree = 'episcopate'/)
  assert.match(migration, /'derived_prerequisite'/)
  assert.match(migration, /La ordenación presbiteral no puede ser anterior a la ordenación diaconal/)
  assert.match(migration, /La ordenación episcopal no puede ser anterior a la ordenación presbiteral/)
  assert.match(migration, /ordination_events_enforce_cumulative_sequence/)
})

test('diaconate can be added to an existing person without creating a duplicate identity', async () => {
  const migration = await readRepoFile('supabase/migrations/20260710203140_reuse_existing_person_for_diaconate.sql')

  assert.match(migration, /v_mode text := coalesce/)
  assert.match(migration, /v_selected_person_id/)
  assert.match(migration, /where p\.id = v_selected_person_id/)
  assert.match(migration, /not exists \(/)
  assert.match(migration, /insert into public\.ordination_events/)
  assert.match(migration, /case when v_mode = 'existing' then 'existing_person_ordination'/)
  assert.match(migration, /on conflict \(person_id\) do update/)
})

test('clerical transition selectors use ordination degree instead of person type', async () => {
  const deaconService = await readRepoFile('src/features/clero/deacon/services/deacon-admin-service.ts')
  const priestService = await readRepoFile('src/features/clero/priest/services/priest-admin-service.ts')
  const bishopService = await readRepoFile('src/features/clero/bishop/services/bishop-admin-service.ts')

  for (const service of [deaconService, priestService, bishopService]) {
    assert.match(service, /from\('person_ecclesial_state'\)/)
    assert.doesNotMatch(service, /person_type/)
  }

  assert.match(deaconService, /eq\('is_lay', true\)/)
  assert.match(priestService, /highest_ordination_degree/)
  assert.match(priestService, /eq\('highest_ordination_degree', 'diaconate'\)/)
  assert.match(bishopService, /highest_ordination_degree/)
  assert.match(bishopService, /'presbyterate', 'episcopate'/)
})
