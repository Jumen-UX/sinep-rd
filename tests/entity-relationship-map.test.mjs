import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public entity profile renders active relationships as a directional hierarchy', async () => {
  const [page, map] = await Promise.all([
    readRepoFile('src/features/entidades/EntityDetailPage.tsx'),
    readRepoFile('src/features/entidades/EntityRelationshipMap.tsx'),
  ])

  assert.match(page, /EntityRelationshipMap/)
  assert.match(page, /relationships=\{data\.relationships\}/)
  assert.match(page, /relatedEntities=\{data\.related_entities\}/)
  assert.doesNotMatch(page, /Entidades relacionadas/)

  assert.match(map, /buildEntityRelationshipMap/)
  assert.match(map, /relationship\.is_current/)
  assert.match(map, /child_entity_id === entity\.id/)
  assert.match(map, /parent_entity_id === entity\.id/)
  assert.match(map, /Nivel superior/)
  assert.match(map, /Entidad actual/)
  assert.match(map, /Nivel subordinado/)
  assert.match(map, /href=\{`\/entidades\/\$\{item\.entity\.slug\}`\}/)
  assert.match(map, /aria-labelledby="entity-relationship-map-title"/)
})
