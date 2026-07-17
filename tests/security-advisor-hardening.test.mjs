import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrationPath = 'supabase/migrations/20260716190402_harden_security_advisor_findings.sql'

async function readMigration() {
  return readFile(new URL(migrationPath, repoRoot), 'utf8')
}

function functionDefinition(sql, schema, name) {
  const marker = `create or replace function ${schema}.${name}`
  const start = sql.indexOf(marker)
  assert.notEqual(start, -1, `Missing ${schema}.${name}`)

  const nextFunction = sql.indexOf('create or replace function ', start + marker.length)
  return sql.slice(start, nextFunction === -1 ? sql.length : nextFunction)
}

test('public institutional views execute as invoker and do not expose workflow state payloads', async () => {
  const migration = await readMigration()

  assert.match(
    migration,
    /create or replace view public\.public_canonical_institutional_timeline\s+with \(security_barrier = true, security_invoker = true\)/i,
  )
  assert.match(
    migration,
    /create or replace view public\.public_entity_evolution_events\s+with \(security_barrier = true, security_invoker = true\)/i,
  )
  assert.match(migration, /null::jsonb as before_state/i)
  assert.match(migration, /null::jsonb as after_state/i)
  assert.match(migration, /where ce\.status = 'applied'/i)
})

test('public participant access is restricted to applied events and public targets', async () => {
  const migration = await readMigration()

  assert.match(migration, /create policy canonical_event_participants_select_anon_public/i)
  assert.match(migration, /ce\.status = 'applied'/i)
  assert.match(migration, /ee\.visibility = 'public'/i)
  assert.match(migration, /ou\.visibility = 'public'/i)
  assert.match(migration, /revoke select on public\.canonical_event_participants from anon/i)
  assert.match(
    migration,
    /grant select \(\s*id,\s*event_id,\s*role,\s*entity_id,\s*organization_unit_id\s*\) on public\.canonical_event_participants to anon/is,
  )

  const anonGrant = migration.match(
    /grant select \((?<columns>[\s\S]*?)\) on public\.canonical_event_participants to anon/i,
  )?.groups?.columns ?? ''
  assert.doesNotMatch(anonGrant, /before_state|after_state/i)
})

test('exposed RPC facade functions execute as invoker', async () => {
  const migration = await readMigration()
  const publicFunctions = [
    'admin_list_user_onboarding_progress',
    'get_my_admin_entry_context',
    'get_my_onboarding_context',
    'save_my_onboarding',
    'validate_admin_role_scope',
    'get_entity_descendants',
  ]

  for (const functionName of publicFunctions) {
    const definition = functionDefinition(migration, 'public', functionName)
    assert.match(definition, /security invoker/i, `${functionName} must be SECURITY INVOKER`)
    assert.doesNotMatch(definition, /security definer/i, `${functionName} must not be SECURITY DEFINER`)
  }
})

test('privileged descendant traversal is private and validates caller scope', async () => {
  const migration = await readMigration()
  const authorizationHelper = functionDefinition(
    migration,
    'app_private',
    'current_user_can_read_entity_descendants',
  )
  const privateReader = functionDefinition(migration, 'app_private', 'get_entity_descendants')
  const publicReader = functionDefinition(migration, 'public', 'get_entity_descendants')

  assert.match(authorizationHelper, /security definer/i)
  assert.match(authorizationHelper, /auth\.uid\(\) is not null/i)
  assert.match(authorizationHelper, /public\.user_role_assignments/i)
  assert.match(authorizationHelper, /target_lineage/i)
  assert.match(privateReader, /security definer/i)
  assert.match(privateReader, /current_user_can_read_entity_descendants\(p_entity_id\)/i)
  assert.match(privateReader, /errcode = '42501'/i)
  assert.match(publicReader, /from app_private\.get_entity_descendants\(p_entity_id, p_max_depth\)/i)
})

test('security-definer implementations are not anonymous API entry points', async () => {
  const migration = await readMigration()

  assert.match(
    migration,
    /revoke (?:all|execute) on function app_private\.get_entity_descendants\(uuid, integer\)\s+from public, anon/i,
  )
  assert.match(
    migration,
    /grant execute on function app_private\.get_entity_descendants\(uuid, integer\)\s+to authenticated, service_role/i,
  )
  assert.match(
    migration,
    /revoke (?:all|execute) on function public\.get_entity_descendants\(uuid, integer\)\s+from public, anon/i,
  )
  assert.match(
    migration,
    /grant execute on function public\.get_entity_descendants\(uuid, integer\)\s+to authenticated, service_role/i,
  )
})
