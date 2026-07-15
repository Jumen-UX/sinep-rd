import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function importAccessPolicy() {
  const source = await readFile(new URL('../src/lib/admin/accessPolicy.ts', import.meta.url), 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  })
  const encoded = Buffer.from(transpiled.outputText, 'utf8').toString('base64')
  return import(`data:text/javascript;base64,${encoded}`)
}

const { resolveAdminRouteDecision } = await importAccessPolicy()

const profiles = [
  { name: 'superadministrador', role: 'super_admin', scope: 'global', state: 'ready', destination: null },
  { name: 'administrador nacional', role: 'national_admin', scope: 'national', state: 'ready', destination: null },
  { name: 'administrador diocesano', role: 'diocesan_admin', scope: 'diocese', state: 'ready', destination: null },
  { name: 'usuario restringido a unidad', role: 'unit_editor', scope: 'organization_unit', state: 'ready', destination: null },
  { name: 'usuario autenticado sin rol', role: null, scope: null, state: 'no_role', destination: '/admin/acceso' },
  { name: 'usuario suspendido', role: 'diocesan_admin', scope: 'diocese', state: 'blocked', destination: '/admin/acceso' },
  { name: 'invitado con onboarding incompleto', role: 'diocesan_admin', scope: 'diocese', state: 'onboarding', destination: '/admin/onboarding' },
]

test('representative administrative profiles follow the canonical entry policy', () => {
  for (const profile of profiles) {
    const decision = resolveAdminRouteDecision({
      pathname: '/admin/personas',
      authenticated: true,
      accessState: profile.state,
    })

    if (profile.destination) {
      assert.deepEqual(decision, { action: 'redirect', destination: profile.destination }, profile.name)
    } else {
      assert.deepEqual(decision, { action: 'continue' }, profile.name)
    }
  }
})

test('anonymous, recovery and control routes preserve their special behavior', () => {
  assert.deepEqual(
    resolveAdminRouteDecision({ pathname: '/admin/personas', authenticated: false, accessState: undefined }),
    { action: 'redirect', destination: '/admin/login' },
  )
  assert.deepEqual(
    resolveAdminRouteDecision({ pathname: '/admin/recuperar', authenticated: false, accessState: undefined }),
    { action: 'continue' },
  )
  assert.deepEqual(
    resolveAdminRouteDecision({ pathname: '/admin/onboarding', authenticated: true, accessState: 'ready' }),
    { action: 'redirect', destination: '/admin' },
  )
  assert.deepEqual(
    resolveAdminRouteDecision({ pathname: '/admin/acceso', authenticated: true, accessState: 'blocked' }),
    { action: 'continue' },
  )
})

test('role and scope examples cover unrestricted and scoped administrative profiles', () => {
  const readyProfiles = profiles.filter((profile) => profile.state === 'ready')
  assert.deepEqual(readyProfiles.map((profile) => profile.scope), [
    'global',
    'national',
    'diocese',
    'organization_unit',
  ])
  assert.ok(readyProfiles.every((profile) => profile.role))
})
