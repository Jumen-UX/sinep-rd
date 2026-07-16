import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const repoRoot = new URL('../', import.meta.url)

async function compileService() {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'sinep-admin-navigation-service-'))
  const source = await readFile(
    new URL('src/features/admin/navigation/admin-navigation-service.ts', repoRoot),
    'utf8',
  )
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const outputPath = path.join(temporaryDirectory, 'admin-navigation-service.mjs')
  await writeFile(outputPath, output, 'utf8')

  return {
    module: await import(pathToFileURL(outputPath).href),
    cleanup: () => rm(temporaryDirectory, { recursive: true, force: true }),
  }
}

function createBuilder(rows) {
  let selectedRows = [...rows]
  const builder = {
    select() {
      return builder
    },
    eq(column, value) {
      selectedRows = selectedRows.filter((row) => row[column] === value)
      return builder
    },
    in(column, values) {
      selectedRows = selectedRows.filter((row) => values.includes(row[column]))
      return Promise.resolve({ data: selectedRows, error: null })
    },
    then(resolve, reject) {
      return Promise.resolve({ data: selectedRows, error: null }).then(resolve, reject)
    },
  }
  return builder
}

function createSupabaseMock({ assignments, names = {}, entry = {} }) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    rpc: async (name) => {
      assert.equal(name, 'get_my_admin_entry_context')
      return {
        data: {
          user_id: 'user-1',
          profile_status: 'active',
          access_state: 'ready',
          ...entry,
        },
        error: null,
      }
    },
    from: (table) => createBuilder(
      table === 'user_role_assignments' ? assignments : names[table] ?? [],
    ),
  }
}

function role(key, name, permissions) {
  return {
    key,
    name,
    role_permissions: permissions.map((permission) => ({
      permissions: {
        key: permission,
        module: permission.split('.')[0],
      },
    })),
  }
}

const fixture = await compileService()
test.after(async () => fixture.cleanup())
const { loadAdminNavigationContext } = fixture.module

test('navigation context combines active roles, permissions and resolved scope labels', async () => {
  const assignments = [
    {
      user_id: 'user-1',
      role_id: 'role-national',
      scope_type: 'national',
      scope_entity_id: null,
      diocese_id: null,
      pastoral_area_id: null,
      organization_unit_id: null,
      starts_at: '2026-01-01',
      ends_at: null,
      status: 'active',
      roles: role('national_admin', 'Administrador Nacional', [
        'people.view',
        'security.view',
      ]),
    },
    {
      user_id: 'user-1',
      role_id: 'role-parish',
      scope_type: 'parish',
      scope_entity_id: 'parish-1',
      diocese_id: 'diocese-1',
      pastoral_area_id: null,
      organization_unit_id: null,
      starts_at: '2026-01-01',
      ends_at: null,
      status: 'active',
      roles: role('parish_editor', 'Editor Parroquial', [
        'people.view',
        'people.create_proposal',
      ]),
    },
  ]
  const supabase = createSupabaseMock({
    assignments,
    names: {
      ecclesiastical_entities: [
        { id: 'parish-1', name: 'Parroquia San Pablo Apóstol' },
      ],
    },
  })

  const context = await loadAdminNavigationContext(supabase)

  assert.equal(context.accessState, 'ready')
  assert.deepEqual(context.permissionKeys, [
    'people.create_proposal',
    'people.view',
    'security.view',
  ])
  assert.deepEqual(context.modules, ['people', 'security'])
  assert.equal(context.availableScopes.length, 2)
  assert.equal(context.activeScope.key, 'national:all')
  assert.equal(context.activeScope.label, 'Ámbito nacional')
  assert.equal(context.roles[1].scopeLabel, 'Parroquia San Pablo Apóstol')
  assert.equal(context.roles[0].isUnrestricted, true)
})

test('expired assignments do not contribute permissions or scopes', async () => {
  const supabase = createSupabaseMock({
    assignments: [
      {
        user_id: 'user-1',
        role_id: 'expired-role',
        scope_type: 'diocese',
        scope_entity_id: 'diocese-1',
        starts_at: '2025-01-01',
        ends_at: '2025-12-31',
        status: 'active',
        roles: role('diocesan_editor', 'Editor Diocesano', ['people.view']),
      },
    ],
  })

  const context = await loadAdminNavigationContext(supabase)

  assert.deepEqual(context.permissionKeys, [])
  assert.deepEqual(context.availableScopes, [])
  assert.equal(context.activeScope.type, 'none')
  assert.equal(context.activeScope.label, 'Sin alcance administrativo activo')
})

test('AdminShell consumes navigation services instead of maintaining parallel route lists or direct RPC calls', async () => {
  const shell = await readFile(
    new URL('src/app/(admin)/admin/AdminShell.tsx', repoRoot),
    'utf8',
  )
  const layout = await readFile(
    new URL('src/app/(admin)/admin/layout.tsx', repoRoot),
    'utf8',
  )

  assert.match(shell, /AdminNavigationProvider/)
  assert.match(shell, /useAdminNavigation/)
  assert.match(shell, /loadCanonicalIncompatibilityCount/)
  assert.match(shell, /mobileItems\.map/)
  assert.match(shell, />Más</)
  assert.doesNotMatch(shell, /const adminNavSections/)
  assert.doesNotMatch(shell, /const mobileNavItems/)
  assert.doesNotMatch(shell, /supabase\.rpc\(/)
  assert.match(layout, /admin-navigation\.css/)
})
