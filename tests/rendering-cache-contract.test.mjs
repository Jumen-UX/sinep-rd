import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const contract = await readFile('docs/architecture/RENDERING_CACHE_CONTRACT.md', 'utf8')
const publicCache = await readFile('src/lib/public/cache.ts', 'utf8')
const personPage = await readFile('src/app/(public)/personas/[slug]/page.tsx', 'utf8')
const personLayout = await readFile('src/app/(public)/personas/[slug]/layout.tsx', 'utf8')
const entityPage = await readFile('src/app/(public)/entidades/[slug]/page.tsx', 'utf8')
const entityLayout = await readFile('src/app/(public)/entidades/[slug]/layout.tsx', 'utf8')
const adminLayout = await readFile('src/app/(admin)/layout.tsx', 'utf8')
const sprint = await readFile('docs/sprints/active/sprint-8.md', 'utf8')

const detailRevalidate = /export const revalidate = 900/

test('rendering contract separates public cacheable and authenticated routes', () => {
  assert.match(contract, /P0 — Públicas estables/)
  assert.match(contract, /P1 — Públicas publicadas y revalidables/)
  assert.match(contract, /P2 — Públicas sensibles al tiempo/)
  assert.match(contract, /A0 — Administrativas autenticadas/)
  assert.match(contract, /API-A — APIs administrativas y mutaciones/)
  assert.match(contract, /O0 — Operación y salud/)
  assert.match(contract, /datos privados, administrativos, personalizados o dependientes de cookies, sesión, rol o alcance no se comparten mediante caché global/)
})

test('public detail cache remains versioned tagged revalidable and explicitly invalidated', () => {
  assert.match(publicCache, /PUBLIC_DETAIL_REVALIDATE_SECONDS = 900/)
  assert.match(publicCache, /unstable_cache/)
  assert.match(publicCache, /\['public-person-detail-v1'\]/)
  assert.match(publicCache, /\['public-entity-detail-v1'\]/)
  assert.match(publicCache, /PUBLIC_PERSON_DETAIL_TAG/)
  assert.match(publicCache, /PUBLIC_ENTITY_DETAIL_TAG/)
  assert.match(publicCache, /revalidateTag\(PUBLIC_PERSON_DETAIL_TAG\)/)
  assert.match(publicCache, /revalidateTag\(PUBLIC_ENTITY_DETAIL_TAG\)/)
  assert.match(publicCache, /revalidatePath\('\/personas'\)/)
  assert.match(publicCache, /revalidatePath\('\/diocesis'\)/)
  assert.match(publicCache, /cache\(loadCachedPublicPersonDetail\)/)
  assert.match(publicCache, /cache\(loadCachedPublicEntityDetail\)/)
})

test('public detail pages and metadata share canonical cached loaders', () => {
  assert.match(personPage, detailRevalidate)
  assert.match(entityPage, detailRevalidate)
  assert.match(personPage, /loadPublicPersonDetail\(slug\)/)
  assert.match(personLayout, /loadPublicPersonDetail\(slug\)/)
  assert.match(entityPage, /loadPublicEntityDetail\(slug\)/)
  assert.match(entityLayout, /loadPublicEntityDetail\(slug\)/)
})

test('administrative rendering stays dynamic and uncached', () => {
  assert.match(adminLayout, /export const dynamic = 'force-dynamic'/)
  assert.match(adminLayout, /export const revalidate = 0/)
  assert.match(adminLayout, /export const fetchCache = 'force-no-store'/)
  assert.match(contract, /Caché compartida: prohibida/)
})

test('sprint 8 records performance search observability and documentation before final validation', () => {
  for (const item of ['S8-01', 'S8-02', 'S8-03', 'S8-04', 'S8-05', 'S8-06', 'S8-07', 'S8-08', 'S8-09']) {
    assert.match(sprint, new RegExp(`\\[x\\] ${item}`))
  }
  assert.match(sprint, /RENDERING_CACHE_CONTRACT\.md/)
  assert.match(sprint, /PUBLIC_INDEXING_ENABLED/)
  assert.match(sprint, /loadPublicDashboardBundle\(\)/)
  assert.match(sprint, /20260718160000_optimize_public_query_indexes\.sql/)
  assert.match(sprint, /20260718234000_create_canonical_admin_search\.sql/)
  assert.match(sprint, /OBSERVABILITY_CONTRACT\.md/)
  assert.match(sprint, /Iniciar S8-10 y ejecutar la validación técnica integral/)
  assert.match(sprint, /S7-10 continúa diferido/)
})
