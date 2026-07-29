import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public home renders a server shell with a bounded territorial payload', async () => {
  const [page, shell, explorer, model, loader, viewsRoute, summaryRoute] = await Promise.all([
    readRepoFile('src/app/(public)/page.tsx'),
    readRepoFile('src/features/public/PublicDashboardShell.tsx'),
    readRepoFile('src/features/public/PublicDashboardExplorer.tsx'),
    readRepoFile('src/features/public/usePublicDashboardModel.ts'),
    readRepoFile('src/lib/public/dashboard.ts'),
    readRepoFile('src/app/api/dashboard/vistas/route.ts'),
    readRepoFile('src/app/api/dashboard/resumen/route.ts'),
  ])

  assert.doesNotMatch(page, /['"]use client['"]/)
  assert.match(page, /loadPublicTerritorialDashboardBundle/)
  assert.match(page, /loadPublicDashboardBundle/)
  assert.match(page, /const initialDataComplete = initialView !== 'territorial'/)
  assert.match(page, /initialDataComplete\s*\?\s*await loadPublicDashboardBundle\(\)\s*:\s*await loadPublicTerritorialDashboardBundle\(\)/)
  assert.match(page, /<PublicDashboardShell/)
  assert.match(page, /initialData=\{initialData\}/)
  assert.match(page, /initialDataComplete=\{initialDataComplete\}/)
  assert.match(page, /initialSummary=\{initialSummary\}/)

  assert.doesNotMatch(shell, /['"]use client['"]/)
  assert.match(shell, /<PublicDashboardExplorer \{\.\.\.props\} \/>/)
  assert.match(shell, /public-mobile-header/)
  assert.match(shell, /public-sidebar/)
  assert.match(shell, /public-bottom-nav/)
  assert.doesNotMatch(shell, /usePublicDashboardModel|onClick=|onChange=/)

  assert.match(explorer, /^['"]use client['"]/)
  assert.match(explorer, /usePublicDashboardModel\(props\)/)
  assert.match(explorer, /deferredDataPending/)
  assert.match(explorer, /deferredDataError/)
  assert.match(explorer, /onClick=|onChange=/)
  assert.match(model, /useState<PublicView>\(initialView\)/)
  assert.match(model, /fetch\('\/api\/dashboard\/vistas'/)
  assert.match(model, /fetch\('\/api\/dashboard\/resumen'/)
  assert.match(model, /Promise\.all/)
  assert.match(model, /AbortController/)
  assert.match(model, /setDashboardData\(data\)/)
  assert.match(model, /setDashboardSummary\(summary\)/)
  assert.match(viewsRoute, /loadPublicDashboardData\(\)/)
  assert.match(summaryRoute, /loadDashboardSummary\(\)/)

  assert.match(loader, /export async function loadPublicTerritorialDashboardBundle/)
  assert.match(loader, /loadPublicTerritorialDashboardDataUncached/)
  assert.match(loader, /people: \[\]/)
  assert.match(loader, /assignments: \[\]/)
  assert.match(loader, /organization_units: \[\]/)
  assert.match(loader, /export async function loadPublicDashboardBundle/)
  assert.match(loader, /buildDashboardSummary\(data\.dioceses, data\.parishes\.length, historicalPeople\)/)
  assert.match(loader, /person_public_directory/)
  assert.match(loader, /public_position_assignments_with_hierarchy/)

  await assert.rejects(access(new URL('src/features/public/PublicDashboardClient.tsx', repoRoot)))
})

test('every secondary dashboard view has its own React lazy chunk while territorial remains initial', async () => {
  const [explorer, loadingStyles] = await Promise.all([
    readRepoFile('src/features/public/PublicDashboardExplorer.tsx'),
    readRepoFile('src/features/public/PublicDashboardExplorer.module.css'),
  ])

  assert.match(explorer, /import \{ lazy, Suspense \} from 'react'/)
  assert.doesNotMatch(explorer, /next\/dynamic/)
  assert.match(explorer, /import styles from '\.\/PublicDashboardExplorer\.module\.css'/)
  assert.match(explorer, /import \{ PublicTerritorialView \} from '\.\/PublicTerritorialView'/)
  for (const viewModule of [
    'PublicPeopleView',
    'PublicPastoralView',
    'PublicAdministrativeView',
    'PublicCollegialView',
  ]) {
    assert.doesNotMatch(explorer, new RegExp(`from ['"]\\./${viewModule}['"]`))
    assert.match(explorer, new RegExp(`lazy\\(\\(\\) => import\\(['"]\\./${viewModule}['"]\\)\\)`))
  }
  assert.equal(explorer.match(/<Suspense fallback=/g)?.length, 4)
  assert.match(explorer, /aria-busy="true"/)
  assert.match(explorer, /role="status" aria-live="polite"/)
  assert.match(explorer, /role="alert"/)
  assert.match(explorer, /retryDeferredData/)
  assert.match(explorer, /styles\.loadingPanel/)
  assert.match(explorer, /styles\.loadingMessage/)
  assert.match(loadingStyles, /\.loadingPanel\s*\{[\s\S]*min-height:/)
  assert.match(loadingStyles, /@media \(max-width: 780px\)/)
  assert.doesNotMatch(explorer, /ssr:\s*false/)

  await assert.rejects(access(new URL('src/features/public/PublicPeoplePastoralViews.tsx', repoRoot)))
  await assert.rejects(access(new URL('src/features/public/PublicOrganizationViews.tsx', repoRoot)))
})

test('public dashboard validates and preserves shareable scope state without server navigation', async () => {
  const [page, shared, model, urlState] = await Promise.all([
    readRepoFile('src/app/(public)/page.tsx'),
    readRepoFile('src/features/public/PublicDashboardShared.tsx'),
    readRepoFile('src/features/public/usePublicDashboardModel.ts'),
    readRepoFile('src/features/public/PublicDashboardUrlState.ts'),
  ])

  for (const parameter of ['vista', 'pais', 'provincia', 'jurisdiccion']) {
    assert.match(page, new RegExp(`params\\.${parameter}`))
  }
  assert.match(page, /initialData\.countries\.some/)
  assert.match(page, /const countryDioceses = initialData\.dioceses\.filter/)
  assert.match(page, /item\.id === requestedJurisdictionId/)
  assert.match(page, /initialCountry=\{initialCountry\}/)
  assert.match(page, /initialJurisdictionId=\{initialJurisdictionId\}/)
  assert.match(shared, /initialCountry: string/)
  assert.match(shared, /initialDataComplete: boolean/)
  assert.match(shared, /initialJurisdictionId: string/)

  assert.match(model, /useEffect\(\(\) =>/)
  assert.match(model, /buildPublicDashboardSearch\(window\.location\.search/)
  assert.match(model, /window\.history\.replaceState/)
  assert.doesNotMatch(model, /router\.replace/)
  assert.match(model, /fetch\('\/api\/dashboard\/vistas'/)
  assert.match(model, /fetch\('\/api\/dashboard\/resumen'/)
  assert.match(model, /useMemo<PersonCard\[\]>/)
  assert.match(model, /const \{ administrativeUnits, collegialUnits \} = useMemo/)

  for (const parameter of ['vista', 'pais', 'provincia', 'jurisdiccion']) {
    assert.match(urlState, new RegExp(`setOptionalParam\\(params, '${parameter}'`))
  }
  assert.doesNotMatch(urlState, /window\.|document\./)
})

test('public navigation contains no placeholder hash destinations', async () => {
  const source = (await Promise.all([
    readRepoFile('src/features/public/PublicDashboardShell.tsx'),
    readRepoFile('src/features/public/PublicDashboardNavigation.ts'),
    readRepoFile('src/features/public/PublicDashboardExplorer.tsx'),
    readRepoFile('src/features/public/PublicDashboardShared.tsx'),
    readRepoFile('src/features/public/PublicTerritorialView.tsx'),
    readRepoFile('src/features/public/PublicPeopleView.tsx'),
    readRepoFile('src/features/public/PublicPastoralView.tsx'),
    readRepoFile('src/features/public/PublicAdministrativeView.tsx'),
    readRepoFile('src/features/public/PublicCollegialView.tsx'),
  ])).join('\n')

  assert.doesNotMatch(source, /href:\s*['"]#['"]/)
  assert.doesNotMatch(source, /href=\{[^}]*['"]#['"]/)
  assert.match(source, /href="\/diocesis"/)
  assert.match(source, /href="\/personas"/)
  assert.match(source, /`\/oficinas\/\$\{item\.id\}`/)
  assert.match(source, /`\/organismos\/\$\{item\.id\}`/)
})

test('public directory pages are server rendered and filter through URLs', async () => {
  const [dioceses, people] = await Promise.all([
    readRepoFile('src/app/(public)/diocesis/page.tsx'),
    readRepoFile('src/app/(public)/personas/page.tsx'),
  ])

  for (const page of [dioceses, people]) {
    assert.doesNotMatch(page, /['"]use client['"]/)
    assert.doesNotMatch(page, /useEffect|window\.history|fetch\(/)
    assert.match(page, /searchParams: Promise/)
  }
  assert.match(dioceses, /loadDioceseDirectory/)
  assert.match(dioceses, /\/diocesis\?provincia=/)
  assert.match(people, /loadPeopleDirectory/)
  assert.match(people, /\/personas\?tipo=/)
})

test('person and entity profiles expose dynamic canonical metadata', async () => {
  const [personLayout, entityLayout] = await Promise.all([
    readRepoFile('src/app/(public)/personas/[slug]/layout.tsx'),
    readRepoFile('src/app/(public)/entidades/[slug]/layout.tsx'),
  ])

  assert.match(personLayout, /generateMetadata/)
  assert.match(personLayout, /loadPublicPersonDetail\(slug\)/)
  assert.match(personLayout, /buildPublicMetadata/)
  assert.match(personLayout, /path: `\/personas\/\$\{person\.slug\}`/)
  assert.match(personLayout, /type: 'profile'/)
  assert.match(personLayout, /path: `\/personas\/\$\{slug\}`[\s\S]*index: false/)

  assert.match(entityLayout, /generateMetadata/)
  assert.match(entityLayout, /loadPublicEntityDetail\(slug\)/)
  assert.match(entityLayout, /buildPublicMetadata/)
  assert.match(entityLayout, /path: `\/entidades\/\$\{entity\.slug\}`/)
  assert.match(entityLayout, /path: `\/entidades\/\$\{slug\}`[\s\S]*index: false/)
})
