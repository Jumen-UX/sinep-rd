import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('person detail is rendered from server data', async () => {
  const page = await readRepoFile('src/app/(public)/personas/[slug]/page.tsx')
  const layout = await readRepoFile('src/app/(public)/personas/[slug]/layout.tsx')
  const loader = await readRepoFile('src/lib/public/person-detail.ts')
  const view = await readRepoFile('src/features/personas/PersonDetailServerView.tsx')

  assert.equal(page.includes("'use client'"), false)
  assert.equal(page.includes('/api/personas'), false)
  assert.equal(page.includes('loadPublicPersonDetail(slug)'), true)
  assert.equal(page.includes('PersonDetailServerView'), true)
  assert.equal(layout.includes('loadPublicPersonDetail(slug)'), true)
  assert.equal(loader.includes('person_public_ordination_history'), true)
  assert.equal(loader.includes('public_position_assignments'), true)
  assert.equal(view.includes('Historia sacramental'), true)
  assert.equal(view.includes('Movimientos pastorales e institucionales'), true)
  assert.equal(view.includes('Cargando ficha'), false)
})

test('entity detail is rendered from server data', async () => {
  const page = await readRepoFile('src/app/(public)/entidades/[slug]/page.tsx')
  const layout = await readRepoFile('src/app/(public)/entidades/[slug]/layout.tsx')
  const loader = await readRepoFile('src/lib/public/entity-detail.ts')
  const view = await readRepoFile('src/features/entidades/EntityDetailServerView.tsx')

  assert.equal(page.includes("'use client'"), false)
  assert.equal(page.includes('/api/entidades'), false)
  assert.equal(page.includes('loadPublicEntityDetail(slug)'), true)
  assert.equal(page.includes('EntityDetailServerView'), true)
  assert.equal(layout.includes('loadPublicEntityDetail(slug)'), true)
  assert.equal(loader.includes('public_entity_evolution_events'), true)
  assert.equal(loader.includes('public_position_assignments_with_hierarchy'), true)
  assert.equal(view.includes('EntityRelationshipMap'), true)
  assert.equal(view.includes('EntityInstitutionalTimeline'), true)
  assert.equal(view.includes('EntityDynamicOrganizationChart'), true)
  assert.equal(view.includes('Cargando entidad'), false)
})
