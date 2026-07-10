import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

test('bishop writes use a private security-definer transaction behind an invoker facade', async () => {
  const migration = await readFile(
    new URL('supabase/migrations/20260710205129_fix_bishop_dimension_rpc_execution_chain.sql', repoRoot),
    'utf8',
  )

  assert.match(migration, /function internal\.admin_save_bishop_with_dimensions\(payload jsonb\)/)
  assert.match(migration, /language plpgsql\s+security definer/)
  assert.match(migration, /if auth\.uid\(\) is null/)
  assert.match(migration, /current_user_has_permission\('people\.create_proposal'\)/)
  assert.match(migration, /current_user_can_manage_person/)
  assert.match(migration, /current_user_can_manage_entity/)
  assert.match(migration, /grant execute on function internal\.admin_save_bishop_with_dimensions\(jsonb\) to authenticated/)
  assert.match(migration, /create or replace function public\.admin_save_bishop\(payload jsonb\)/)
  assert.match(migration, /language sql/)
  assert.doesNotMatch(
    migration.slice(migration.indexOf('create or replace function public.admin_save_bishop')),
    /security definer/,
  )
  assert.match(migration, /select internal\.admin_save_bishop_with_dimensions\(payload\)/)
  assert.match(migration, /revoke all on function public\.admin_save_bishop\(jsonb\) from public, anon/)
})
