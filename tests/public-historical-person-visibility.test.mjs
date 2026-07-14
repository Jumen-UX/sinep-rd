import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = new URL('../supabase/migrations/20260714050000_include_historical_public_persons.sql', import.meta.url)

async function loadMigration() {
  return readFile(migrationPath, 'utf8')
}

test('public directory includes historical public person statuses without exposing private records', async () => {
  const sql = await loadMigration()

  assert.match(sql, /create or replace view public\.person_public_directory/i)
  assert.match(sql, /with \(security_invoker = true\)/i)
  assert.match(sql, /pes\.visibility = 'public'/i)
  assert.match(sql, /'active','retired','emeritus','deceased','transferred'/i)
  assert.doesNotMatch(sql, /pes\.status = 'active'/i)
})

test('public episcopal history includes deceased bishops through canonical ordination events', async () => {
  const sql = await loadMigration()

  assert.match(sql, /create or replace view public\.public_episcopal_ordinations/i)
  assert.match(sql, /from public\.ordination_events oe/i)
  assert.match(sql, /oe\.degree = 'episcopate'/i)
  assert.match(sql, /bishop\.visibility = 'public'/i)
  assert.match(sql, /bishop\.status = any/i)
  assert.doesNotMatch(sql, /bishop\.status = 'active'/i)
  assert.match(sql, /grant select on public\.person_public_directory to anon, authenticated/i)
  assert.match(sql, /grant select on public\.public_episcopal_ordinations to anon, authenticated/i)
})
