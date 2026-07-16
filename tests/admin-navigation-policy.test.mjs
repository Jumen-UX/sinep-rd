import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const repoRoot = new URL('../', import.meta.url)

async function compileNavigationModules() {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'sinep-admin-navigation-'))
  const contractSource = await readFile(
    new URL('src/features/admin/navigation/admin-navigation-contract.ts', repoRoot),
    'utf8',
  )
  const policySource = await readFile(
    new URL('src/features/admin/navigation/admin-navigation-policy.ts', repoRoot),
    'utf8',
  )
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  }

  const contractOutput = ts.transpileModule(contractSource, { compilerOptions }).outputText
  const policyOutput = ts.transpileModule(policySource, { compilerOptions }).outputText.replace(
    /from ['"]\.\/admin-navigation-contract['"]/,
    "from './admin-navigation-contract.mjs'",
  )
  const contractPath = path.join(temporaryDirectory, 'admin-navigation-contract.mjs')
  const policyPath = path.join(temporaryDirectory, 'admin-navigation-policy.mjs')

  await Promise.all([
    writeFile(contractPath, contractOutput, 'utf8'),
    writeFile(policyPath, policyOutput, 'utf8'),
  ])

  return {
    contract: await import(pathToFileURL(contractPath).href),
    policy: await import(pathToFileURL(policyPath).href),
    cleanup: () => rm(temporaryDirectory, { recursive: true, force: true }),
  }
}

const fixture = await compileNavigationModules()
test.after(async () => fixture.cleanup())

const { adminNavigationItems } = fixture.contract
const {
  getAdminNavigationAvailability,
  getMobileAdminNavigationItems,
  getVisibleAdminNavigationItems,
  getVisibleAdminNavigationSections,
  isActiveAdminNavigationItem,
} = fixture.policy

const allPermissions = Array.from(new Set(adminNavigationItems.flatMap((item) => [
  ...item.entryPermissions,
  ...(item.operationPermissions ?? []),
])))

const viewerPermissions = [
  'appointments.view',
  'change_requests.view',
  'documents.view',
  'entities.view',
  'events.view',
  'pastorals.view',
  'people.view',
  'reports.view',
]

function context(overrides = {}) {
  return {
    accessState: 'ready',
    permissionKeys: [],
    activeScopeType: 'diocese',
    isUnrestricted: false,
    ...overrides,
  }
}

function visibleById(policyContext) {
  return new Map(getVisibleAdminNavigationItems(policyContext).map((item) => [item.id, item]))
}

test('unrestricted administrators see the complete canonical registry', () => {
  const visible = getVisibleAdminNavigationItems(context({
    permissionKeys: allPermissions,
    activeScopeType: 'national',
    isUnrestricted: true,
  }))

  assert.equal(visible.length, adminNavigationItems.length)
  assert.equal(visible.every((item) => item.availability === 'available'), true)
  assert.equal(visible.some((item) => item.id === 'countries'), true)
  assert.equal(visible.some((item) => item.id === 'settings'), true)
})

test('internal viewers receive a read-only experience without system management modules', () => {
  const visible = visibleById(context({ permissionKeys: viewerPermissions }))

  assert.equal(visible.get('home')?.availability, 'available')
  assert.equal(visible.get('people')?.availability, 'read_only')
  assert.equal(visible.get('appointments')?.availability, 'read_only')
  assert.equal(visible.get('review')?.availability, 'read_only')
  assert.equal(visible.get('events')?.availability, 'read_only')
  assert.equal(visible.has('create'), false)
  assert.equal(visible.has('imports'), false)
  assert.equal(visible.has('structure'), false)
  assert.equal(visible.has('activity'), false)
  assert.equal(visible.has('users'), false)
  assert.equal(visible.has('countries'), false)
  assert.equal(visible.has('settings'), false)
})

test('restricted diocesan contexts cannot expose national catalog or settings destinations', () => {
  const visible = visibleById(context({ permissionKeys: ['security.view'] }))

  assert.equal(visible.has('countries'), false)
  assert.equal(visible.has('settings'), false)
})

test('national contexts expose global settings read-only without manage permission', () => {
  const visible = visibleById(context({
    permissionKeys: ['security.view'],
    activeScopeType: 'national',
  }))

  assert.equal(visible.get('countries')?.availability, 'read_only')
  assert.equal(visible.get('settings')?.availability, 'read_only')
})

test('operation permissions promote a directory from read-only to available', () => {
  const peopleItem = adminNavigationItems.find((item) => item.id === 'people')
  assert.ok(peopleItem)

  assert.equal(getAdminNavigationAvailability(peopleItem, context({
    permissionKeys: ['people.view'],
  })), 'read_only')

  assert.equal(getAdminNavigationAvailability(peopleItem, context({
    permissionKeys: ['people.view', 'people.create_proposal'],
  })), 'available')
})

test('non-ready administrative states expose no navigation destinations', () => {
  for (const accessState of ['onboarding', 'no_role', 'blocked']) {
    assert.deepEqual(getVisibleAdminNavigationItems(context({
      accessState,
      permissionKeys: allPermissions,
      isUnrestricted: true,
    })), [])
  }
})

test('section resolution removes empty groups and preserves canonical order', () => {
  const sections = getVisibleAdminNavigationSections(context({
    permissionKeys: ['people.view'],
  }))

  assert.deepEqual(sections.map((section) => section.key), ['home', 'directories'])
  assert.deepEqual(sections[1].items.map((item) => item.id), ['people'])
})

test('mobile navigation keeps home and selects the highest-priority permitted destinations', () => {
  const mobileItems = getMobileAdminNavigationItems(context({
    permissionKeys: viewerPermissions,
  }))

  assert.deepEqual(mobileItems.map((item) => item.id), ['home', 'people', 'review'])
})

test('active route matching includes nested routes without activating the dashboard globally', () => {
  assert.equal(isActiveAdminNavigationItem('/admin', '/admin'), true)
  assert.equal(isActiveAdminNavigationItem('/admin/personas/123', '/admin/personas'), true)
  assert.equal(isActiveAdminNavigationItem('/admin/personas', '/admin/personas'), true)
  assert.equal(isActiveAdminNavigationItem('/admin/personas', '/admin'), false)
  assert.equal(isActiveAdminNavigationItem('/admin/eventos', '/admin/personas'), false)
})
