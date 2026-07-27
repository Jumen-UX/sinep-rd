import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('multi-country territorial rendering stays inside the typed React dashboard', async () => {
  const [layout, scopeBuilder, territorialView] = await Promise.all([
    readRepoFile('src/app/layout.tsx'),
    readRepoFile('src/features/public/buildPublicDashboardScope.ts'),
    readRepoFile('src/features/public/PublicTerritorialView.tsx'),
  ])

  assert.doesNotMatch(layout, /PublicMultiCountryDashboard|public-multi-country-dashboard/)
  assert.doesNotMatch(territorialView, /innerHTML|MutationObserver|setInterval|document\.createElement/)
  assert.match(territorialView, /scopedDioceses\.filter\(isSpecial\)/)
  assert.match(territorialView, /aria-label=\{`Resumen territorial de \$\{scopeTitle\}`\}/)

  assert.match(scopeBuilder, /item\.country_iso2 \? item\.country_iso2 === country : country === 'DO'/)
  assert.match(scopeBuilder, /const inTerritorialScope/)
  assert.match(scopeBuilder, /scopedParishes = initialData\.parishes\.filter\(\(item\) => inTerritorialScope/)
  assert.match(scopeBuilder, /scopedPastoral = initialData\.organization_units\.filter\(\(item\) => inTerritorialScope/)
  assert.match(scopeBuilder, /\.filter\(\(item\) => assignmentMatches\(item, scopedSlugs\)\)/)

  await assert.rejects(
    access(new URL('src/features/public/components/public-multi-country-dashboard.tsx', repoRoot)),
    (error) => error?.code === 'ENOENT',
  )
})
