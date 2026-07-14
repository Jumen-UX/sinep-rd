import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routePath = 'src/app/(admin)/admin/estructura/cargos/page.tsx'
const pagePath = 'src/features/structures/admin/LevelOfficeConfigurationPage.tsx'
const servicePath = 'src/features/structures/services/level-office-admin-service.ts'

const directSupabaseFrom = /\bsupabase\s*\.\s*from\s*\(/
const directSupabaseRpc = /\bsupabase\s*\.\s*rpc\s*\(/

test('level office route delegates to the structures feature', async () => {
  const route = await readFile(routePath, 'utf8')

  assert.match(route, /from '@\/features\/structures'/)
  assert.doesNotMatch(route, /createClient/)
  assert.doesNotMatch(route, directSupabaseFrom)
  assert.doesNotMatch(route, directSupabaseRpc)
  assert.doesNotMatch(route, /fetch\s*\(/)
})

test('level office page delegates data access to the structure service', async () => {
  const page = await readFile(pagePath, 'utf8')

  assert.match(page, /level-office-admin-service/)
  assert.match(page, /loadLevelOfficeBaseData/)
  assert.match(page, /loadStructureTemplates/)
  assert.match(page, /loadLevelOfficeTemplateData/)
  assert.match(page, /saveLevelOfficeConfiguration/)
  assert.doesNotMatch(page, directSupabaseFrom)
  assert.doesNotMatch(page, directSupabaseRpc)
})

test('level office tables and RPC remain behind the service', async () => {
  const service = await readFile(servicePath, 'utf8')

  assert.match(service, /ecclesiastical_entities/)
  assert.match(service, /office_configurations/)
  assert.match(service, /get_structure_templates/)
  assert.match(service, /structure_levels/)
  assert.match(service, /structure_level_office_configurations/)
  assert.match(service, /saveLevelOfficeConfiguration/)
})
