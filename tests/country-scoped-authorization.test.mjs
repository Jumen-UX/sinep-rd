import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const repoRoot = new URL('../', import.meta.url)
const contextMigration = '20260727204813_add_country_context_to_authorization.sql'
const writerMigration = '20260727205540_enforce_country_anchored_role_assignments.sql'

async function compileTypeScriptModule(relativePath, outputName) {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'sinep-country-authorization-'))
  const source = await readFile(new URL(relativePath, repoRoot), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const outputPath = path.join(temporaryDirectory, outputName)
  await writeFile(outputPath, output, 'utf8')

  return {
    module: await import(pathToFileURL(outputPath).href),
    cleanup: () => rm(temporaryDirectory, { recursive: true, force: true }),
  }
}

function queryResult(value) {
  return Promise.resolve({ data: value, error: null })
}

function assignmentQuery(assignments) {
  let filters = 0
  const query = {
    select() {
      return query
    },
    eq() {
      filters += 1
      return filters >= 2 ? queryResult(assignments) : query
    },
  }
  return query
}

function namedQuery(rows) {
  return {
    select() {
      return {
        in() {
          return queryResult(rows)
        },
      }
    },
  }
}

function fakeSupabase(assignments) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
        error: null,
      }),
    },
    rpc: async () => ({
      data: {
        user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        profile_status: 'active',
        access_state: 'ready',
      },
      error: null,
    }),
    from(table) {
      if (table === 'user_role_assignments') return assignmentQuery(assignments)
      if (table === 'ecclesiastical_entities') {
        return namedQuery([
          {
            id: '60000000-0000-4000-8000-000000000001',
            name: 'República Dominicana',
          },
        ])
      }
      return namedQuery([])
    },
  }
}

const navigationFixture = await compileTypeScriptModule(
  'src/features/admin/navigation/admin-navigation-service.ts',
  'admin-navigation-service.mjs',
)
const accessFixture = await compileTypeScriptModule(
  'src/features/access/services/user-access-admin-service.ts',
  'user-access-admin-service.mjs',
)

test.after(async () => {
  await navigationFixture.cleanup()
  await accessFixture.cleanup()
})

const { loadAdminNavigationContext } = navigationFixture.module
const { scopeNeedsEntity, userScopeTypes } = accessFixture.module

function role(key, name) {
  return {
    key,
    name,
    role_permissions: [
      { permissions: [{ key: 'entities.view', module: 'entities' }] },
    ],
  }
}

test('repository keeps the exact applied country authorization migration versions', async () => {
  const migrationDirectory = new URL('supabase/migrations/', repoRoot)
  const files = await readdir(migrationDirectory)

  assert.equal(files.includes(contextMigration), true)
  assert.equal(files.includes(writerMigration), true)
  assert.equal(files.includes('20260727210000_add_country_context_to_authorization.sql'), false)
})

test('country context migration derives and audits country without globalizing super admin', async () => {
  const migration = await readFile(
    new URL(`supabase/migrations/${contextMigration}`, repoRoot),
    'utf8',
  )

  assert.match(migration, /add column if not exists country_iso2 char\(2\)/)
  assert.match(migration, /references public\.country_catalog\(iso2\)/)
  assert.match(migration, /resolve_entity_country_iso2/)
  assert.match(migration, /resolve_scope_country_iso2/)
  assert.match(migration, /current_user_country_iso2s/)
  assert.match(migration, /current_user_can_access_country/)
  assert.match(migration, /role_row\.key <> 'super_admin'/)
  assert.match(migration, /role_row\.key = 'super_admin'/)
  assert.match(migration, /new\.country_iso2 := null/)
  assert.match(migration, /derive_role_assignment_country_context/)
  assert.match(migration, /derive_audit_country_context/)
})

test('role writers require a country entity and deny global scope to non-super roles', async () => {
  const migration = await readFile(
    new URL(`supabase/migrations/${writerMigration}`, repoRoot),
    'utf8',
  )

  assert.match(migration, /El alcance nacional requiere una entidad país activa/)
  assert.match(migration, /Solo super_admin puede conservar un alcance global/)
  assert.match(migration, /Debes seleccionar el país del alcance nacional/)
  assert.match(migration, /type_row\.key = 'country'/)
  assert.match(migration, /current_user_can_access_country/)
  assert.match(migration, /select 'national'::text, ee\.id, ee\.name::text/)
  assert.match(migration, /scope_entity_id,country_iso2,diocese_id/)
  assert.match(migration, /'country_iso2',v_country_iso2/)
  assert.match(migration, /app_private\.current_user_has_role\(array\['super_admin'\]\)/)
})

test('country-backed national administrator is restricted and labeled with its country', async () => {
  const context = await loadAdminNavigationContext(fakeSupabase([
    {
      role_id: '11111111-1111-4111-8111-111111111111',
      scope_type: 'national',
      scope_entity_id: '60000000-0000-4000-8000-000000000001',
      country_iso2: 'DO',
      starts_at: '2026-01-01',
      ends_at: null,
      status: 'active',
      roles: role('national_admin', 'Administrador nacional'),
    },
  ]))

  assert.equal(context.activeScope.type, 'national')
  assert.equal(context.activeScope.label, 'República Dominicana')
  assert.equal(context.activeScope.isUnrestricted, false)
  assert.equal(context.roles[0].isUnrestricted, false)
})

test('super administrator remains the only role treated as globally unrestricted', async () => {
  const context = await loadAdminNavigationContext(fakeSupabase([
    {
      role_id: '22222222-2222-4222-8222-222222222222',
      scope_type: 'national',
      scope_entity_id: null,
      country_iso2: null,
      starts_at: '2026-01-01',
      ends_at: null,
      status: 'active',
      roles: role('super_admin', 'Superadministrador'),
    },
  ]))

  assert.equal(context.activeScope.label, 'Ámbito nacional')
  assert.equal(context.activeScope.isUnrestricted, true)
  assert.equal(context.roles[0].isUnrestricted, true)
})

test('navigation query includes country context and no longer globalizes national_admin by role name', async () => {
  const source = await readFile(
    new URL('src/features/admin/navigation/admin-navigation-service.ts', repoRoot),
    'utf8',
  )

  assert.match(source, /scope_entity_id,country_iso2,diocese_id/)
  assert.match(source, /const unrestrictedRoleKeys = new Set\(\['super_admin'\]\)/)
  assert.match(source, /scopeType === 'national' && !countryIso2/)
  assert.doesNotMatch(source, /\['super_admin', 'national_admin'\]/)
})

test('user access and invitation flows require a country selector for national roles', async () => {
  const [accessPage, invitePage, serviceSource] = await Promise.all([
    readFile(new URL('src/features/access/admin/UserAccessPage.tsx', repoRoot), 'utf8'),
    readFile(new URL('src/features/access/admin/InviteUserPage.tsx', repoRoot), 'utf8'),
    readFile(new URL('src/features/access/services/user-access-admin-service.ts', repoRoot), 'utf8'),
  ])

  assert.equal(scopeNeedsEntity('national'), true)
  assert.equal(scopeNeedsEntity('diocese'), true)
  assert.equal(scopeNeedsEntity('global'), false)
  assert.equal(userScopeTypes.find((scope) => scope.value === 'national')?.label, 'País')
  assert.match(accessPage, /scopeNeedsEntity\(selectedScopeType\)/)
  assert.match(invitePage, /scopeNeedsEntity\(scopeType\)/)
  assert.match(serviceSource, /scope_entity_id: input\.roleId && scopeNeedsEntity\(input\.scopeType\)/)
  assert.doesNotMatch(serviceSource, /!\['national', 'global'\]\.includes\(scopeType\)/)
})
