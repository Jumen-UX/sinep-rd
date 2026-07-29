import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public home renders a server shell around one interactive explorer', async () => {
  const [page, shell, explorer, model, loader] = await Promise.all([
    readRepoFile('src/app/(public)/page.tsx'),
    readRepoFile('src/features/public/PublicDashboardShell.tsx'),
    readRepoFile('src/features/public/PublicDashboardExplorer.tsx'),
    readRepoFile('src/features/public/usePublicDashboardModel.ts'),
    readRepoFile('src/lib/public/dashboard.ts'),
  ])

  assert.doesNotMatch(page, /['"]use client['"]/) 
  assert.match(page, /loadPublicDashboardBundle\(\)/)
  assert.doesNotMatch(page, /Promise\.all\(\[loadPublicDashboardData\(\), loadDashboardSummary\(\)\]\)/)
  assert.match(page, /data: initialData, summary: initialSummary/)
  assert.match(page, /<PublicDashboardShell/)
  assert.match(page, /initialData=\{initialData\}/)
  assert.match(page, /initialSummary=\{initialSummary\}/)

  assert.doesNotMatch(shell, /['"]use client['"]/) 
  assert.match(shell, /<PublicDashboardExplorer \{\.\.\.props\} \/>/)
  assert.match(shell, /public-mobile-header/)
  assert.match(shell, /public-sidebar/)
  assert.match(shell, /public-bottom-nav/)
  assert.doesNotMatch(shell, /usePublicDashboardModel|onClick=|onChange=/)

  assert.match(explorer, /^['"]use client['"]/)
  assert.match(explorer, /usePublicDashboardModel\(props\)/)
  assert.match(explorer, /onClick=|onChange=/)
  assert.match(model, /useState<PublicView>\(initialView\)/)
  assert.doesNotMatch(`${explorer}\n${model}`, /fetch\(['"]\/api\/dashboard/)

  assert.match(loader, /export async function loadPublicDashboardBundle/)
  assert.match(loader, /buildDashboardSummary\(data\.dioceses, data\.parishes\.length, historicalPeople\)/)
  assert.match(loader, /person_public_directory/)
  assert.match(loader, /public_position_assignments_with_hierarchy/)

  await assert.rejects(access(new URL('src/features/public/PublicDashboardClient.tsx', repoRoot)))
})

test('secondary dashboard views are lazy while territorial remains in the initial explorer', async () => {
  const explorer = await readRepoFile('src/features/public/PublicDashboardExplorer.tsx')

  assert.match(explorer, /import dynamic from 'next\/dynamic'/)
  assert.match(explorer, /import \{ PublicTerritorialView \} from '\.\/PublicTerritorialView'/)
  assert.doesNotMatch(explorer, /from '\.\/PublicPeoplePastoralViews'/)
  assert.doesNotMatch(explorer, /from '\.\/PublicOrganizationViews'/)
  assert.match(explorer, /import\('\.\/PublicPeoplePastoralViews'\)\.then\(\(module\) => module\.PublicPeopleView\)/)
  assert.match(explorer, /import\('\.\/PublicPeoplePastoralViews'\)\.then\(\(module\) => module\.PublicPastoralView\)/)
  assert.match(explorer, /import\('\.\/PublicOrganizationViews'\)\.then\(\(module\) => module\.PublicAdministrativeView\)/)
  assert.match(explorer, /import\('\.\/PublicOrganizationViews'\)\.then\(\(module\) => module\.PublicCollegialView\)/)
  assert.match(explorer, /aria-busy="true"/)
  assert.match(explorer, /role="status" aria-live="polite"/)
  assert.doesNotMatch(explorer, /ssr:\s*false/)
})

test('public navigation contains no placeholder hash destinations', async () => {
  const source = (await Promise.all([
    readRepoFile('src/features/public/PublicDashboardShell.tsx'),
    readRepoFile('src/features/public/PublicDashboardNavigation.ts'),
    readRepoFile('src/features/public/PublicDashboardExplorer.tsx'),
    readRepoFile('src/features/public/PublicDashboardShared.tsx'),
    readRepoFile('src/features/public/PublicTerritorialView.tsx'),
    readRepoFile('src/features/public/PublicPeoplePastoralViews.tsx'),
    readRepoFile('src/features/public/PublicOrganizationViews.tsx'),
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
