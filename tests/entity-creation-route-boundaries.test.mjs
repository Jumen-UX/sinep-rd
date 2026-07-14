import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routes = [
  'src/app/(admin)/admin/nuevo/jurisdiccion/page.tsx',
  'src/app/(admin)/admin/nuevo/parroquia/page.tsx',
  'src/app/(admin)/admin/nuevo/capilla/page.tsx',
]

const featurePages = [
  'src/features/entities/admin/NewJurisdictionPage.tsx',
  'src/features/entities/admin/NewParishPage.tsx',
  'src/features/entities/admin/NewChapelPage.tsx',
]

test('entity creation routes delegate to the entities feature', async () => {
  for (const path of routes) {
    const route = await readFile(path, 'utf8')

    assert.match(route, /from '@\/features\/entities'/)
    assert.doesNotMatch(route, /createClient/)
    assert.doesNotMatch(route, /reviewPotentialDuplicates/)
    assert.doesNotMatch(route, /\.from\s*\(/)
    assert.doesNotMatch(route, /\.rpc\s*\(/)
    assert.doesNotMatch(route, /fetch\s*\(/)
  }
})

test('entity creation workflows remain inside the entities feature', async () => {
  const [jurisdiction, parish, chapel] = await Promise.all(
    featurePages.map((path) => readFile(path, 'utf8')),
  )

  for (const page of [jurisdiction, parish, chapel]) {
    assert.match(page, /reviewPotentialDuplicates/)
    assert.match(page, /\/api\/admin\/paises/)
    assert.match(page, /ecclesiastical_entities/)
  }

  assert.match(jurisdiction, /\/api\/admin\/jurisdiccion/)
  assert.match(parish, /\/api\/admin\/entidad/)
  assert.match(chapel, /\/api\/admin\/entidad/)
  assert.match(parish, /StructureHierarchySelector/)
})
