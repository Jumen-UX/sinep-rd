import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public entity detail page uses the cached server loader without a browser API request', async () => {
  const [page, view, loader, cache] = await Promise.all([
    readRepoFile('src/app/(public)/entidades/[slug]/page.tsx'),
    readRepoFile('src/features/entidades/EntityDetailServerView.tsx'),
    readRepoFile('src/lib/public/entity-detail.ts'),
    readRepoFile('src/lib/public/cache.ts'),
  ])

  assert.doesNotMatch(page, /['"]use client['"]/)
  assert.doesNotMatch(page, /useEffect/)
  assert.doesNotMatch(page, /fetch\(\s*['"`]\/api\/entidades/)
  assert.match(page, /loadPublicEntityDetail\(slug\)/)
  assert.match(page, /EntityDetailServerView/)
  assert.match(page, /export const revalidate = 900/)
  assert.match(loader, /public_entity_evolution_events/)
  assert.match(loader, /public_position_assignments_with_hierarchy/)
  assert.match(loader, /fetchSupabaseJson<PublicEntityRelationship\[]>\('public_entity_relationships'/)
  assert.doesNotMatch(loader, /fetchSupabaseJson<PublicEntityRelationship\[]>\('entity_relationships'/)
  assert.doesNotMatch(loader, /'status','notes'/)
  assert.match(cache, /loadCachedPublicEntityDetail/)
  assert.match(view, /<EntityProfileNavigation/)

  await assert.rejects(access(new URL('../src/features/entidades/EntityDetailPage.tsx', import.meta.url)))
  await assert.rejects(access(new URL('../src/app/api/entidades/[slug]/route.ts', import.meta.url)))
})

test('public entity profiles preserve Next.js not-found responses', async () => {
  const page = await readRepoFile('src/app/(public)/entidades/[slug]/page.tsx')

  assert.match(page, /notFound, unstable_rethrow/)
  assert.match(page, /if \(!data\) notFound\(\)/)
  assert.match(page, /catch \(error\) \{\s+unstable_rethrow\(error\)/)
})
