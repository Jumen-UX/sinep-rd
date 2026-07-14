import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath = 'supabase/migrations/20260714231500_harden_structure_level_office_configuration.sql'
const servicePath = 'src/features/structures/services/level-office-admin-service.ts'
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('level office configuration is atomic, scoped and audited', async () => {
  const migration = await read(migrationPath)

  assert.match(migration, /rpc_definer__admin_save_structure_level_offices/)
  assert.match(migration, /security definer/)
  assert.match(migration, /for update of sl/)
  assert.match(migration, /structure_template_in_scope/)
  assert.match(migration, /Uno o más cargos seleccionados no existen o no están activos/)
  assert.match(migration, /El cargo predeterminado debe pertenecer a la selección/)
  assert.match(migration, /delete from public\.structure_level_office_configurations/)
  assert.match(migration, /insert into public\.structure_level_office_configurations/)
  assert.match(migration, /structures\.level_offices\.updated/)
  assert.match(migration, /create_audit_log/)
  assert.match(migration, /revoke all on function app_private\.rpc_definer__admin_save_structure_level_offices\(jsonb\) from public,anon,authenticated/)
})

test('level office feature writes only through the canonical RPC', async () => {
  const service = await read(servicePath)
  const saveBlock = service.slice(service.indexOf('export async function saveLevelOfficeConfiguration'))

  assert.match(saveBlock, /admin_save_structure_level_offices/)
  assert.match(saveBlock, /default_office_configuration_id/)
  assert.doesNotMatch(saveBlock, /\.delete\s*\(/)
  assert.doesNotMatch(saveBlock, /\.insert\s*\(/)
  assert.doesNotMatch(saveBlock, /structure_level_office_configurations/)
})
