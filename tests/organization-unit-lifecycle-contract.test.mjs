import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath = 'supabase/migrations/20260714180000_add_organization_unit_lifecycle_contract.sql'
const apiPath = 'src/app/api/admin/organizacion/route.ts'
const servicePath = 'src/features/organizacion/services/organization-unit-admin-service.ts'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('organization unit lifecycle is explicit, scoped and audited', async () => {
  const migration = await read(migrationPath)

  assert.match(migration, /admin_transition_organization_unit/)
  assert.match(migration, /pastorals\.approve/)
  assert.match(migration, /pastorals\.publish/)
  assert.match(migration, /current_user_can_manage_entity/)
  assert.match(migration, /pastorals\.organization_unit\.approved/)
  assert.match(migration, /pastorals\.organization_unit\.published/)
  assert.match(migration, /create_audit_log/)
  assert.match(migration, /Solo se pueden publicar unidades activas y vigentes/)
  assert.match(migration, /revoke all on function app_private\.rpc_definer__admin_transition_organization_unit\(jsonb\) from public,anon,authenticated/)
})

test('organization API and feature service expose lifecycle transitions', async () => {
  const [api, service] = await Promise.all([read(apiPath), read(servicePath)])

  assert.match(api, /export async function PATCH/)
  assert.match(api, /admin_transition_organization_unit/)
  assert.match(api, /pastorals\.approve/)
  assert.match(api, /pastorals\.publish/)
  assert.match(service, /OrganizationUnitLifecycleAction/)
  assert.match(service, /transitionOrganizationUnit/)
  assert.match(service, /method: 'PATCH'/)
})
