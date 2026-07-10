import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('structures feature exposes typed domain contracts and presets', async () => {
  const featureIndex = await readRepoFile('src/features/structures/index.ts')
  const types = await readRepoFile('src/features/structures/types/index.ts')
  const presets = await readRepoFile('src/features/structures/config/presets.ts')

  assert.match(featureIndex, /export \* from '\.\/types'/)
  assert.match(featureIndex, /export \* from '\.\/config\/presets'/)
  assert.match(featureIndex, /export \* from '\.\/services\/structure-admin-service'/)

  for (const contract of [
    'StructureTemplate',
    'StructureLevel',
    'StructureTreeNode',
    'SaveStructureTemplatePayload',
    'SaveStructureLevelPayload',
    'SaveStructureNodePayload',
  ]) {
    assert.match(types, new RegExp(`export type ${contract}`))
  }

  assert.match(presets, /export const structurePresets/)
  assert.match(presets, /vicaria-zona-parroquia-sector/)
  assert.match(presets, /area-comision-equipo/)
})

test('structure admin service centralizes canonical reads and writes', async () => {
  const service = await readRepoFile('src/features/structures/services/structure-admin-service.ts')

  for (const rpc of [
    'get_structure_templates',
    'get_structure_tree',
    'get_structure_child_level_options',
    'admin_save_structure_template',
    'admin_save_structure_level',
    'admin_save_structure_node',
  ]) {
    assert.ok(service.includes(`rpc('${rpc}'`), `El servicio debe centralizar ${rpc}`)
  }

  assert.match(service, /from\('structure_levels'\)/)
  assert.doesNotMatch(service, /from\('structure_templates'\)[\s\S]{0,180}\.(insert|update|delete)\(/)
  assert.doesNotMatch(service, /from\('structure_levels'\)[\s\S]{0,180}\.(insert|update|delete)\(/)
  assert.doesNotMatch(service, /from\('structure_nodes'\)[\s\S]{0,180}\.(insert|update|delete)\(/)
})
