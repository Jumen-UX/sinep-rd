import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routePath = 'src/app/api/sugerencias/route.ts'
const migrationPath = 'supabase/migrations/20260801223247_add_distributed_public_suggestion_rate_limit.sql'

test('public suggestions use a distributed server-only rate limiter', async () => {
  const [route, migration] = await Promise.all([
    readFile(routePath, 'utf8'),
    readFile(migrationPath, 'utf8'),
  ])

  assert.match(route, /x-vercel-forwarded-for/)
  assert.match(route, /createHmac\('sha256'/)
  assert.match(route, /consume_public_suggestion_rate_limit/)
  assert.match(route, /status: 429/)
  assert.match(route, /'Retry-After'/)
  assert.doesNotMatch(route, /new Map|setInterval|buildSupabaseRestUrl/)

  assert.match(migration, /create table if not exists public\.public_suggestion_rate_limits/)
  assert.match(migration, /on conflict \(fingerprint\) do update/)
  assert.match(migration, /burst_request_count < 5/)
  assert.match(migration, /daily_request_count < 20/)
  assert.match(migration, /security invoker/)
})

test('the distributed limiter cannot be bypassed with the public Supabase key', async () => {
  const migration = await readFile(migrationPath, 'utf8')

  assert.match(
    migration,
    /revoke insert on table public\.public_change_suggestions from anon, authenticated/,
  )
  assert.match(migration, /drop policy if exists public_change_suggestions_public_insert/)
  assert.match(
    migration,
    /revoke all on function public\.consume_public_suggestion_rate_limit\(text\)[\s\S]*?from public, anon, authenticated/,
  )
  assert.match(
    migration,
    /grant execute on function public\.consume_public_suggestion_rate_limit\(text\)[\s\S]*?to service_role/,
  )
})
