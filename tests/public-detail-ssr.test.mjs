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
  assert.equal(cacheLayer.includes("PUBLIC_PERSON_DETAIL_TAG = 'public-person-details'"), true)
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
  assert.equal(cacheLayer.includes("PUBLIC_ENTITY_DETAIL_TAG = 'public-entity-details'"), true)
  assert.equal(view.includes('EntityRelationshipMap'), true)
  assert.equal(view.includes('EntityInstitutionalTimeline'), true)
  assert.equal(view.includes('EntityDynamicOrganizationChart'), true)
  assert.equal(view.includes('Cargando entidad'), false)
})

test('admin mutations invalidate public detail caches', async () => {
  const cacheLayer = await readRepoFile('src/lib/public/cache.ts')
  const mutationRoutes = await Promise.all([
    'src/app/api/admin/sacerdote/route.ts',
    'src/app/api/admin/obispo/route.ts',
    'src/app/api/admin/diacono/route.ts',
    'src/app/api/admin/laico/route.ts',
    'src/app/api/admin/religioso/route.ts',
    'src/app/api/admin/asignacion/route.ts',
    'src/app/api/admin/estructura/nodo-entidad/route.ts',
  ].map(readRepoFile))

  assert.equal(cacheLayer.includes('revalidateTag(PUBLIC_PERSON_DETAIL_TAG)'), true)
  assert.equal(cacheLayer.includes('revalidateTag(PUBLIC_ENTITY_DETAIL_TAG)'), true)
  assert.equal(cacheLayer.includes("revalidatePath('/personas')"), true)
  assert.equal(cacheLayer.includes("revalidatePath('/diocesis')"), true)
  assert.equal(mutationRoutes.every((route) => route.includes('revalidatePublicContent')), true)
})
