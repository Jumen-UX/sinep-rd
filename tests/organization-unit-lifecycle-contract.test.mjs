import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const lifecycleMigrationPath = 'supabase/migrations/20260714180000_add_organization_unit_lifecycle_contract.sql'
const contentMigrationPath = 'supabase/migrations/20260714181500_separate_organization_unit_content_from_lifecycle.sql'
const apiPath = 'src/app/api/admin/organizacion/route.ts'
const servicePath = 'src/features/organizacion/services/organization-unit-admin-service.ts'
const pagePath = 'src/features/organizacion/admin/OrganizationUnitManagerPage.tsx'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('organization unit lifecycle is explicit, scoped and audited', async () => {
  const migration = await read(lifecycleMigrationPath)

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

test('ordinary organization saves cannot mutate lifecycle fields', async () => {
  const [migration, api, service] = await Promise.all([
    read(contentMigrationPath),
    read(apiPath),
    read(servicePath),
  ])

  assert.match(migration, /payload - 'status' - 'visibility'/)
  assert.match(migration, /'status','draft'/)
  assert.match(migration, /'visibility','internal'/)
  assert.match(api, /'status' in payload \|\| 'visibility' in payload/)
  assert.doesNotMatch(service, /SaveOrganizationUnitPayload[\s\S]*status:/)
  assert.doesNotMatch(service, /SaveOrganizationUnitPayload[\s\S]*visibility:/)
})

test('organization API, service and manager expose explicit lifecycle actions', async () => {
  const [api, service, page] = await Promise.all([read(apiPath), read(servicePath), read(pagePath)])

  assert.match(api, /export async function PATCH/)
  assert.match(api, /admin_transition_organization_unit/)
  assert.match(api, /pastorals\.approve/)
  assert.match(api, /pastorals\.publish/)
  assert.match(service, /OrganizationUnitLifecycleAction/)
  assert.match(service, /transitionOrganizationUnit/)
  assert.match(service, /method: 'PATCH'/)
  assert.match(page, /lifecycleOptions/)
  assert.match(page, /handleLifecycle/)
  assert.match(page, /Aprobar unidad/)
  assert.match(page, /Publicar/)
  assert.match(page, /El guardado modifica contenido y jerarquía\. No aprueba ni publica la unidad\./)
  assert.doesNotMatch(page, /<label>Estado/)
  assert.doesNotMatch(page, /<label>Visibilidad/)
})
