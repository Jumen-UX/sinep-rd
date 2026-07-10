import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('structure configurator is fully composed from the feature domain', async () => {
  const page = await read('src/features/structures/admin/StructureConfiguratorPage.tsx')
  for (const contract of [
    'useStructureConfigurator',
    'StructureSummary',
    'StructurePresetGrid',
    'StructureTreeList',
    'StructureNodeEditor',
    'StructureNodeDetailPanel',
    'StructureLevelEditor',
    'StructureLevelOfficeEditor',
  ]) assert.match(page, new RegExp(contract))
  assert.match(page, /saveStructureLevelOffices/)
  assert.match(page, /loadStructureNodeDetail/)
  assert.doesNotMatch(page, /\.from\(/)
  assert.doesNotMatch(page, /\.rpc\(/)
})

test('level office mappings are protected by scope and RPC-only writes', async () => {
  const sql = await read('supabase/migrations/20260710184500_save_structure_level_office_mappings.sql')
  assert.match(sql, /structure_template_in_scope/)
  assert.match(sql, /admin_save_structure_level_offices/)
  assert.match(sql, /get_structure_level_office_options/)
  assert.match(sql, /revoke all .* anon/)
  assert.match(sql, /grant execute .* authenticated/)
})
