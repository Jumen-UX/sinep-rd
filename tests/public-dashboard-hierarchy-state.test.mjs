import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const statePath = new URL('../src/features/public/PublicDashboardHierarchyState.ts', import.meta.url)
const modelPath = new URL('../src/features/public/usePublicDashboardModel.ts', import.meta.url)
const explorerPath = new URL('../src/features/public/PublicDashboardExplorer.tsx', import.meta.url)

async function read(path) {
  return readFile(path, 'utf8')
}

test('public dashboard owns one extensible hierarchy state contract', async () => {
  const source = await read(statePath)

  assert.match(source, /country: string/)
  assert.match(source, /province: string/)
  assert.match(source, /jurisdictionId: string/)
  assert.match(source, /structureNodeId: string/)
  assert.match(source, /parishId: string/)
  assert.match(source, /publicDashboardHierarchyReducer/)
})

test('changing a hierarchy ancestor clears every dependent descendant atomically', async () => {
  const source = await read(statePath)

  assert.match(source, /case 'set_country':[\s\S]*province: ''[\s\S]*jurisdictionId: ''[\s\S]*structureNodeId: ''[\s\S]*parishId: ''/)
  assert.match(source, /case 'set_province':[\s\S]*jurisdictionId: ''[\s\S]*structureNodeId: ''[\s\S]*parishId: ''/)
  assert.match(source, /case 'set_jurisdiction':[\s\S]*structureNodeId: ''[\s\S]*parishId: ''/)
  assert.match(source, /case 'set_structure_node':[\s\S]*parishId: ''/)
})

test('dashboard model and explorer consume canonical hierarchy actions without manual reset chains', async () => {
  const [model, explorer] = await Promise.all([read(modelPath), read(explorerPath)])

  assert.match(model, /useReducer\(\s*publicDashboardHierarchyReducer/)
  assert.match(model, /dispatchHierarchy\(\{ type: 'set_country', value \}\)/)
  assert.match(model, /dispatchHierarchy\(\{ type: 'set_province', value \}\)/)
  assert.match(model, /dispatchHierarchy\(\{ type: 'set_jurisdiction', value \}\)/)
  assert.match(explorer, /onChange=\{setCountry\}/)
  assert.match(explorer, /onChange=\{setProvince\}/)
  assert.match(explorer, /onChange=\{setJurisdictionId\}/)
  assert.doesNotMatch(explorer, /setCountry\(nextCountry\)[\s\S]*setProvince\(''\)/)
  assert.doesNotMatch(explorer, /setProvince\(nextProvince\)[\s\S]*setJurisdictionId\(''\)/)
})
