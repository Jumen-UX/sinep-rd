import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('public dashboard persists node and parish scope in the shareable URL', async () => {
  const [urlState, model, page] = await Promise.all([
    read('src/features/public/PublicDashboardUrlState.ts'),
    read('src/features/public/usePublicDashboardModel.ts'),
    read('src/app/(public)/page.tsx'),
  ])

  assert.match(urlState, /setOptionalParam\(params, 'nodo', structureNodeId\)/)
  assert.match(urlState, /setOptionalParam\(params, 'parroquia', parishId\)/)
  assert.match(model, /structureNodeId,\s*parishId/)
  assert.match(model, /buildPublicDashboardScope\(dashboardData, country, province, jurisdictionId, parishId\)/)
  assert.match(page, /params\.nodo/)
  assert.match(page, /params\.parroquia/)
  assert.match(page, /item\.id === requestedParishId && item\.diocese_id === initialJurisdictionId/)
})

test('parish selection is progressive and scoped to the selected jurisdiction', async () => {
  const [explorer, scope, hierarchy] = await Promise.all([
    read('src/features/public/PublicDashboardExplorer.tsx'),
    read('src/features/public/buildPublicDashboardScope.ts'),
    read('src/features/public/PublicDashboardHierarchyState.ts'),
  ])

  assert.match(explorer, /disabled=\{!jurisdictionId\}\s*label="Parroquia"/)
  assert.match(explorer, /jurisdictionParishes/)
  assert.match(explorer, /onChange=\{setParishId\}/)
  assert.match(scope, /selectedParish/)
  assert.match(scope, /selectedParish \? \[selectedParish\] : jurisdictionParishes/)
  assert.match(scope, /effectiveSlugs/)
  assert.match(hierarchy, /case 'set_jurisdiction':[\s\S]*parishId: ''/)
  assert.match(hierarchy, /case 'set_structure_node':[\s\S]*parishId: ''/)
})
