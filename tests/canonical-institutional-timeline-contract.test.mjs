import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('administrative timeline is canonical read only and status aware', async () => {
  const migration = await readRepoFile('supabase/migrations/20260716013000_project_canonical_institutional_timeline.sql')

  assert.match(migration, /create or replace view public\.canonical_institutional_timeline/)
  assert.match(migration, /from public\.canonical_events ce/)
  assert.match(migration, /left join public\.canonical_event_participants cep/)
  assert.match(migration, /ce\.status as workflow_status/)
  assert.match(migration, /coalesce\(ce\.effective_date, ce\.event_date, ce\.created_at::date\)/)
  assert.doesNotMatch(migration, /insert into|update public\.|delete from/i)
})

test('public timeline exposes applied public targets only', async () => {
  const migration = await readRepoFile('supabase/migrations/20260716014500_fix_public_canonical_timeline_access.sql')

  assert.match(migration, /create or replace view public\.public_canonical_institutional_timeline/)
  assert.match(migration, /where ce\.status = 'applied'/)
  assert.match(migration, /ee\.visibility = 'public'/)
  assert.match(migration, /ou\.visibility = 'public'/)
  assert.match(migration, /grant select on public\.public_canonical_institutional_timeline to anon, authenticated/)
  assert.doesNotMatch(migration, /canonical_institutional_timeline\s+where/i)
})

test('state reconstruction is stable read only and compares projected state', async () => {
  const migration = await readRepoFile('supabase/migrations/20260716013000_project_canonical_institutional_timeline.sql')

  assert.match(migration, /create or replace function public\.get_institutional_state_reconstruction/)
  assert.match(migration, /language sql\s+stable/)
  assert.match(migration, /reconstruction_available/)
  assert.match(migration, /matches_current_state/)
  assert.match(migration, /after_state/)
  assert.doesNotMatch(migration, /security definer/i)
})
