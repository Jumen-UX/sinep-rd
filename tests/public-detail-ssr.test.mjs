import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('person detail is rendered and cached from server data', async () => {
  const page = await readRepoFile('src/app/(public)/personas/[slug]/page.tsx')
  const layout = await readRepoFile('src/app/(public)/personas/[slug]/layout.tsx')
  const loader = await readRepoFile('src/lib/public/person-detail.ts')
  const cacheLayer = await readRepoFile('src/lib/public/cache.ts')
  const view = await readRepoFile('src/features/personas/PersonDetailServerView.tsx')

  assert.equal(page.includes("'use client'"), false)
  assert.equal(page.includes('/api/personas'), false)
  assert.equal(page.includes("from '@/lib/public/cache'"), true)
  assert.equal(page.includes('export const revalidate = 900'), true)
  assert.equal(page.includes('loadPublicPersonDetail(slug)'), true)
  assert.equal(page.includes('PersonDetailServerView'), true)
  assert.equal(layout.includes("from '@/lib/public/cache'"), true)
  assert.equal(layout.includes('loadPublicPersonDetail(slug)'), true)
  assert.equal(loader.includes('person_public_ordination_history'), true)
  assert.equal(loader.includes('public_position_assignments'), true)
  assert.equal(cacheLayer.includes('unstable_cache'), true)
  assert.equal(cacheLayer.includes('PUBLIC_PERSON_DETAIL_TAG = PUBLIC_CACHE_TAGS.directories'), true)
  assert.equal(view.includes('Historia sacramental'), true)
  assert.equal(view.includes('Movimientos pastorales e institucionales'), true)
  assert.equal(view.includes('Cargando ficha'), false)
})

test('entity detail is rendered and cached from server data', async () => {
  const page = await readRepoFile('src/app/(public)/entidades/[slug]/page.tsx')
  const layout = await readRepoFile('src/app/(public)/entidades/[slug]/layout.tsx')
  const loader = await readRepoFile('src/lib/public/entity-detail.ts')
  const cacheLayer = await readRepoFile('src/lib/public/cache.ts')
  const view = await readRepoFile('src/features/entidades/EntityDetailServerView.tsx')

  assert.equal(page.includes("'use client'"), false)
  assert.equal(page.includes('/api/entidades'), false)
  assert.equal(page.includes("from '@/lib/public/cache'"), true)
  assert.equal(page.includes('export const revalidate = 900'), true)
  assert.equal(page.includes('loadPublicEntityDetail(slug)'), true)
  assert.equal(page.includes('EntityDetailServerView'), true)
  assert.equal(layout.includes("from '@/lib/public/cache'"), true)
  assert.equal(layout.includes('loadPublicEntityDetail(slug)'), true)
  assert.equal(loader.includes('public_entity_evolution_events'), true)
  assert.equal(loader.includes('public_position_assignments_with_hierarchy'), true)
  assert.equal(cacheLayer.includes('PUBLIC_ENTITY_DETAIL_TAG = PUBLIC_CACHE_TAGS.directories'), true)
  assert.equal(view.includes('EntityRelationshipMap'), true)
  assert.equal(view.includes('EntityInstitutionalTimeline'), true)
  assert.equal(view.includes('EntityDynamicOrganizationChart'), true)
  assert.equal(view.includes('Cargando entidad'), false)
})

test('admin mutations invalidate the consolidated public directory cache', async () => {
  const cacheLayer = await readRepoFile('src/lib/public/cache.ts')
  const mutationRoutes = await Promise.all([
    'src/app/api/admin/sacerdote/route.ts',
    'src/app/api/admin/obispo/route.ts',
    'src/app/api/admin/diacono/route.ts',
    'src/app/api/admin/laico/route.ts',
    'src/app/api/admin/religioso/route.ts',
    'src/app/api/admin/asignacion/route.ts',
    'src/app/api/admin/estructura/nodo-entidad/route.ts',
    'src/app/api/admin/persona-canonica/route.ts',
    'src/app/api/admin/entidad/route.ts',
    'src/app/api/admin/jurisdiccion/route.ts',
    'src/app/api/admin/paises/route.ts',
    'src/app/api/admin/organizacion/route.ts',
  ].map(readRepoFile))

  assert.equal(cacheLayer.includes("revalidatePublicCache('directories')"), true)
  assert.equal(cacheLayer.includes('revalidateTag('), false)
  assert.equal(cacheLayer.includes("revalidatePath(`/personas/${personSlug}`)"), true)
  assert.equal(cacheLayer.includes("revalidatePath(`/entidades/${entitySlug}`)"), true)
  assert.equal(mutationRoutes.every((route) => route.includes('revalidatePublicContent')), true)
})

test('approved person proposals use a server route and invalidate cached profiles', async () => {
  const browserClient = await readRepoFile('src/lib/supabase/client.ts')
  const reviewRoute = await readRepoFile('src/app/api/admin/solicitudes/revisar/route.ts')

  assert.equal(browserClient.includes("functionName === 'admin_review_person_change_request'"), true)
  assert.equal(browserClient.includes("fetch('/api/admin/solicitudes/revisar'"), true)
  assert.equal(reviewRoute.includes("rpc('admin_review_person_change_request'"), true)
  assert.equal(reviewRoute.includes("decision === 'approved'"), true)
  assert.equal(reviewRoute.includes('revalidatePublicContent()'), true)
})
