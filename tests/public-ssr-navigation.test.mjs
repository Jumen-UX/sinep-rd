import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public home renders one consolidated dashboard bundle before hydration', async () => {
  const [page, client, loader] = await Promise.all([
    readRepoFile('src/app/(public)/page.tsx'),
    Promise.all([
      readRepoFile('src/features/public/PublicDashboardClient.tsx'),
      readRepoFile('src/features/public/usePublicDashboardModel.ts'),
    ]).then((parts) => parts.join('\n')),
    readRepoFile('src/lib/public/dashboard.ts'),
  ])

  assert.doesNotMatch(page, /['"]use client['"]/) 
  assert.match(page, /loadPublicDashboardBundle\(\)/)
  assert.doesNotMatch(page, /Promise\.all\(\[loadPublicDashboardData\(\), loadDashboardSummary\(\)\]\)/)
  assert.match(page, /data: initialData, summary: initialSummary/)
  assert.match(page, /initialData=\{initialData\}/)
  assert.match(page, /initialSummary=\{initialSummary\}/)
  assert.match(client, /useState<PublicView>\(initialView\)/)
  assert.doesNotMatch(client, /fetch\(['"]\/api\/dashboard/)
  assert.match(loader, /export async function loadPublicDashboardBundle/)
  assert.match(loader, /buildDashboardSummary\(data\.dioceses, data\.parishes\.length, historicalPeople\)/)
  assert.match(loader, /person_public_directory/)
  assert.match(loader, /public_position_assignments_with_hierarchy/)
})

test('public navigation contains no placeholder hash destinations', async () => {
  const client = (await Promise.all([
    readRepoFile('src/features/public/PublicDashboardClient.tsx'),
    readRepoFile('src/features/public/PublicDashboardShared.tsx'),
    readRepoFile('src/features/public/PublicTerritorialView.tsx'),
    readRepoFile('src/features/public/PublicPeoplePastoralViews.tsx'),
    readRepoFile('src/features/public/PublicOrganizationViews.tsx'),
  ])).join('\n')

  assert.doesNotMatch(client, /href:\s*['"]#['"]/)
  assert.doesNotMatch(client, /href=\{[^}]*['"]#['"]/)
  assert.match(client, /href="\/diocesis"/)
  assert.match(client, /href="\/personas"/)
  assert.match(client, /`\/oficinas\/\$\{item\.id\}`/)
  assert.match(client, /`\/organismos\/\$\{item\.id\}`/)
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
