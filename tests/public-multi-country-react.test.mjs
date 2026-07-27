import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('multi-country territorial rendering stays inside the typed React dashboard', async () => {
  const [layout, scopeBuilder, dashboardModel, territorialView] = await Promise.all([
    readRepoFile('src/app/layout.tsx'),
    readRepoFile('src/features/public/buildPublicDashboardScope.ts'),
    readRepoFile('src/features/public/usePublicDashboardModel.ts'),
    readRepoFile('src/features/public/PublicTerritorialView.tsx'),
  ])

  assert.doesNotMatch(
    layout,
    /PublicMultiCountryDashboard|PublicTerritorialLevelEnhancements|public-multi-country-dashboard|public-territorial-level-enhancements/,
  )
  assert.doesNotMatch(territorialView, /innerHTML|MutationObserver|setInterval|document\.createElement/)
  assert.match(territorialView, /scopedDioceses\.filter\(isSpecial\)/)
  assert.match(territorialView, /aria-label=\{`Resumen territorial de \$\{scopeTitle\}`\}/)

  assert.match(scopeBuilder, /item\.country_iso2 \? item\.country_iso2 === country : country === 'DO'/)
  assert.match(scopeBuilder, /const inTerritorialScope/)
  assert.match(scopeBuilder, /scopedParishes = initialData\.parishes\.filter\(\(item\) => inTerritorialScope/)
  assert.match(scopeBuilder, /scopedPastoral = initialData\.organization_units\.filter\(\(item\) => inTerritorialScope/)
  assert.match(scopeBuilder, /\.filter\(\(item\) => assignmentMatches\(item, scopedSlugs\)\)/)

  assert.match(dashboardModel, /initialData\.countries\.some\(\(item\) => item\.key === 'DO'\)/)
  assert.match(dashboardModel, /scope\.scopeFiltered \|\| country !== 'DO'/)
  assert.match(dashboardModel, /territoriallyLinkedPeople/)

  const retiredBridges = [
    'src/features/public/components/public-multi-country-dashboard.tsx',
    'src/features/public/components/public-territorial-level-enhancements.tsx',
  ]
  for (const path of retiredBridges) {
    await assert.rejects(
      access(new URL(path, repoRoot)),
      (error) => error?.code === 'ENOENT',
    )
  }
})

test('public feature code does not interpolate data through raw HTML sinks', async () => {
  const publicFeatureRoot = new URL('src/features/public/', repoRoot)
  const files = (await readdir(publicFeatureRoot, { recursive: true }))
    .filter((path) => path.endsWith('.tsx'))

  for (const path of files) {
    const source = await readFile(new URL(path, publicFeatureRoot), 'utf8')
    assert.doesNotMatch(
      source,
      /\.innerHTML\s*=|insertAdjacentHTML|dangerouslySetInnerHTML/,
      `${path} must render untrusted data through React text nodes, not raw HTML sinks`,
    )
  }
})
