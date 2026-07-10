import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('clerical dimensions use independent canonical history tables', async () => {
  const core = await readRepoFile('supabase/migrations/20260710203853_clerical_dimensions_core_tables.sql')

  for (const table of [
    'clerical_incardinations',
    'clerical_status_history',
    'episcopal_roles',
    'person_ecclesiastical_dignities',
  ]) {
    assert.match(core, new RegExp(`create table public\\.${table}`))
  }

  assert.match(core, /clerical_incardinations_one_current_idx/)
  assert.match(core, /clerical_status_history_one_current_idx/)
  assert.match(core, /episcopal_roles_current_identity_idx/)
  assert.match(core, /person_ecclesiastical_dignities_current_idx/)
  assert.match(core, /role_type <> 'coadjutor' or has_right_of_succession = true/)
})

test('legacy clergy fields synchronize with canonical histories during transition', async () => {
  const sync = await readRepoFile('supabase/migrations/20260710203927_clerical_dimensions_history_sync.sql')

  assert.match(sync, /clerical_incardinations_sync_legacy/)
  assert.match(sync, /clergy_profiles_sync_dimensions_insert/)
  assert.match(sync, /clergy_profiles_sync_dimensions_update/)
  assert.match(sync, /when 'transferred' then 'active'/)
  assert.match(sync, /when 'excardinated' then 'active'/)
  assert.match(sync, /when 'incardinated' then 'active'/)
  assert.match(sync, /v_legacy_status := case new\.status_type/)
})

test('terminal clerical states close current appointments in both assignment models', async () => {
  const sync = await readRepoFile('supabase/migrations/20260710203927_clerical_dimensions_history_sync.sql')
  const guard = await readRepoFile('supabase/migrations/20260710204731_enforce_terminal_clerical_status_assignments.sql')

  for (const migration of [sync, guard]) {
    assert.match(migration, /'deceased'\s*,\s*'lost_clerical_state'/)
    assert.match(migration, /assignment_status\s*=\s*'ended'/)
    assert.match(migration, /status\s*=\s*'ended'/)
  }

  assert.match(guard, /position_assignments_terminal_clerical_status/)
  assert.match(guard, /appointments_terminal_clerical_status/)
})

test('public clerical readers are security invoker projections', async () => {
  const readers = await readRepoFile('supabase/migrations/20260710204024_clerical_dimensions_read_contracts.sql')

  for (const view of [
    'person_current_clerical_state',
    'person_current_episcopal_roles',
    'person_current_ecclesiastical_dignities',
  ]) {
    assert.match(readers, new RegExp(`create view public\\.${view}`))
  }

  assert.equal((readers.match(/security_invoker = true/g) ?? []).length, 3)
  assert.match(readers, /Campo de compatibilidad\. La fuente canónica es clerical_incardinations/)
  assert.match(readers, /Campo de compatibilidad\. La fuente canónica es clerical_status_history/)
})

test('historical episcopal offices backfill roles and dignities conservatively', async () => {
  const backfill = await readRepoFile('supabase/migrations/20260710203958_backfill_clerical_dimensions.sql')

  assert.match(backfill, /'obispo diocesano' then 'diocesan'/)
  assert.match(backfill, /'obispo auxiliar' then 'auxiliary'/)
  assert.match(backfill, /'obispo coadjutor','arzobispo coadjutor'/)
  assert.match(backfill, /'obispo emerito' then 'emeritus'/)
  assert.match(backfill, /'administrador apostolico' then 'apostolic_administrator'/)
  assert.match(backfill, /'archbishop'/)
  assert.match(backfill, /'metropolitan'/)
  assert.doesNotMatch(backfill, /title_see_name[\s\S]*insert into/)
})

test('bishop save validates presbyterate through canonical ordinations', async () => {
  const core = await readRepoFile('supabase/migrations/20260710204231_canonical_bishop_save_core.sql')
  const wrapper = await readRepoFile('supabase/migrations/20260710204301_save_bishop_canonical_dimensions.sql')

  assert.match(core, /from public\.ordination_events oe/)
  assert.match(core, /oe\.degree='presbyterate'/)
  assert.match(core, /oe\.degree='episcopate'/)
  assert.doesNotMatch(core, /v_existing_type/)
  assert.doesNotMatch(core, /v_existing_type <> 'priest'/)
  assert.match(wrapper, /insert into public\.episcopal_roles/)
  assert.match(wrapper, /insert into public\.clerical_status_history/)
  assert.match(wrapper, /insert into public\.person_ecclesiastical_dignities/)
  assert.match(wrapper, /source_position_assignment_id/)
})
