import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrationName = '20260728205504_make_current_user_can_security_invoker.sql'

test('final current_user_can migration is versioned', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))
  assert.equal(files.includes(migrationName), true)
})

test('public current_user_can is security invoker and delegates to a private typed helper', async () => {
  const migration = await readFile(
    new URL(`supabase/migrations/${migrationName}`, repoRoot),
    'utf8',
  )

  assert.match(migration, /create or replace function public\.current_user_can/)
  assert.match(migration, /security invoker/)
  assert.match(migration, /current_user_can_manage_scope/)
  assert.match(
    migration,
    /grant execute on function app_private\.current_user_can_manage_scope\(text,text,uuid,uuid,uuid,uuid,uuid\) to authenticated/,
  )
  assert.match(migration, /revoke all on function public\.current_user_can.*public,anon/s)
  assert.match(migration, /grant execute on function public\.current_user_can.*authenticated/s)
  assert.doesNotMatch(migration, /security definer/)
})
