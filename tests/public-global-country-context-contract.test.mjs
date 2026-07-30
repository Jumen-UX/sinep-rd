import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('global territorial results retain country context', async () => {
  const [shared, scope, explorer, territorial] = await Promise.all([
    read('src/features/public/PublicDashboardShared.tsx'),
    read('src/features/public/buildPublicDashboardScope.ts'),
    read('src/features/public/PublicDashboardExplorer.tsx'),
    read('src/features/public/PublicTerritorialView.tsx'),
  ])

  assert.match(shared, /showCountry = false/)
  assert.match(shared, /showCountry \? item\.country_name : null/)
  assert.match(explorer, /country \? null : item\.country_name/)
  assert.match(scope, /country \? null : item\.country_name/)
  assert.match(territorial, /const globalScope = !country/)
  assert.match(territorial, /showCountry=\{globalScope\}/)
  assert.match(territorial, /países con catálogo público/)
  assert.match(territorial, /Selecciona un país/)
  assert.match(territorial, /sin mezclar territorios homónimos/)
  assert.doesNotMatch(territorial, /Este país todavía no tiene provincias/)
})
