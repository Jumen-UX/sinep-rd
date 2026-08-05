import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('public jurisdiction portal preserves only active discovery scope on the server', async () => {
  const [urlState, model, page] = await Promise.all([
    read('src/features/public/PublicDashboardUrlState.ts'),
    read('src/features/public/usePublicDashboardModel.ts'),
    read('src/app/(public)/page.tsx'),
  ])

  assert.match(urlState, /setOptionalParam\(params, 'pais', country, defaultCountry\)/)
  assert.match(urlState, /setOptionalParam\(params, 'provincia', province\)/)
  assert.match(urlState, /setOptionalParam\(params, 'jurisdiccion', jurisdictionId\)/)
  assert.match(model, /publicDashboardHierarchyReducer/)
  assert.match(model, /setJurisdictionId: \(value: string\) => dispatchHierarchy/)
  assert.match(page, /params\.pais/)
  assert.match(page, /params\.provincia/)
  assert.match(page, /params\.jurisdiccion/)
  assert.doesNotMatch(page, /params\.nodo|params\.parroquia/)
  assert.match(page, /initialStructureNodeId=""/)
  assert.match(page, /initialParishId=""/)
})

test('internal territorial depth remains frozen outside the public product scope', async () => {
  const [page, navigation] = await Promise.all([
    read('src/app/(public)/page.tsx'),
    read('src/features/public/PublicDashboardNavigation.ts'),
  ])

  assert.doesNotMatch(page, /requestedStructureNodeId|requestedParishId/)
  assert.doesNotMatch(navigation, /personas|pastoral|administrativa|colegial/i)
})
