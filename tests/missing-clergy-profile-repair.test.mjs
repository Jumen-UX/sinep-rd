import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('historical canonical clergy without profiles are repaired idempotently', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260715193000_repair_missing_canonical_clergy_profiles.sql',
  )

  assert.match(migration, /insert into public\.clergy_profiles/)
  assert.match(migration, /from public\.ordination_events oe/)
  assert.match(migration, /left join public\.clergy_profiles cp/)
  assert.match(migration, /cp\.person_id is null/)
  assert.match(migration, /oe\.degree in \('diaconate', 'presbyterate', 'episcopate'\)/)
  assert.match(migration, /on conflict \(person_id\) do nothing/)
  assert.doesNotMatch(migration, /where\s+p\.id\s*=\s*'[^']+'/i)
})

test('missing clergy profile diagnostic is scoped and not anonymous', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260715193000_repair_missing_canonical_clergy_profiles.sql',
  )

  assert.match(migration, /admin_count_missing_clergy_profiles\(\)/)
  assert.match(migration, /security definer/)
  assert.match(migration, /set search_path = public, app_private, auth, pg_temp/)
  assert.match(migration, /current_user_can_manage_person\('people\.view_private', oe\.person_id\)/)
  assert.match(migration, /revoke all on function public\.admin_count_missing_clergy_profiles\(\) from anon/)
  assert.match(migration, /grant execute on function public\.admin_count_missing_clergy_profiles\(\) to authenticated/)
})

test('canonical registration continues to create or update one clergy profile per person', async () => {
  const engine = await readRepoFile(
    'supabase/migrations/20260710220313_unified_canonical_person_registration_engine.sql',
  )

  assert.match(engine, /insert into public\.clergy_profiles/)
  assert.match(engine, /on conflict \(person_id\) do update set/)
  assert.match(engine, /returning id into v_clergy_profile_id/)
})
