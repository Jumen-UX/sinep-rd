import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../supabase/migrations/20260801210500_enforce_public_organization_unit_validity.sql',
  import.meta.url,
)

async function readMigration() {
  return readFile(migrationUrl, 'utf8')
}

test('public organization units require publication and current lifecycle state', async () => {
  const migration = await readMigration()

  assert.match(migration, /ou\.status\s*=\s*'active'/)
  assert.match(migration, /ou\.visibility\s*=\s*'public'/)
  assert.match(migration, /ou\.is_current\s*=\s*true/)
  assert.match(migration, /oc\.status\s*=\s*'active'/)
  assert.match(migration, /oc\.visibility\s*=\s*'public'/)
})

test('public organization units exclude future and expired records', async () => {
  const migration = await readMigration()

  assert.match(
    migration,
    /\(ou\.valid_from\s+is\s+null\s+or\s+ou\.valid_from\s*<=\s*current_date\)/i,
  )
  assert.match(
    migration,
    /\(ou\.valid_to\s+is\s+null\s+or\s+ou\.valid_to\s*>=\s*current_date\)/i,
  )
})

test('public projection keeps security invoker and grants read-only access', async () => {
  const migration = await readMigration()

  assert.match(migration, /with\s*\(security_invoker\s*=\s*true\)/i)
  assert.match(
    migration,
    /grant\s+select\s+on\s+public\.public_organization_units\s+to\s+anon,\s*authenticated/i,
  )
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete|all)/i)
})
