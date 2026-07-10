import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('the admin configurator route is minimal and writes through canonical structure RPCs', async () => {
  const route = await readRepoFile('src/app/(admin)/admin/estructura/page.tsx')
  const page = await readRepoFile('src/features/structures/admin/StructureConfiguratorPage.tsx')
  const service = await readRepoFile('src/features/structures/services/structure-admin-service.ts')

  assert.equal(route.trim(), "export { default } from '@/features/structures/admin/StructureConfiguratorPage'")
  assert.match(page, /export default function StructureConfiguratorPage/)

  assert.match(service, /rpc\('admin_save_structure_template'/)
  assert.match(service, /rpc\('admin_save_structure_level'/)
  assert.match(service, /rpc\('admin_save_structure_node'/)
  assert.match(service, /rpc\('get_structure_templates'/)
  assert.match(service, /rpc\('get_structure_tree'/)

  assert.doesNotMatch(service, /from\('structure_templates'\)[\s\S]{0,160}\.(insert|update|delete)\(/)
  assert.doesNotMatch(service, /from\('structure_levels'\)[\s\S]{0,160}\.(insert|update|delete)\(/)
  assert.doesNotMatch(service, /from\('structure_nodes'\)[\s\S]{0,160}\.(insert|update|delete)\(/)
})

test('legacy hierarchy catalogs are traceable and read-only', async () => {
  const sql = await readRepoFile('supabase/migrations/20260710164009_annotate_and_freeze_legacy_structure_catalogs.sql')

  assert.match(sql, /legacy_template_id/)
  assert.match(sql, /legacy_level_id/)
  assert.match(sql, /canonical_engine/)
  assert.match(sql, /guard_legacy_structure_write/)

  for (const table of [
    'diocese_structure_templates',
    'diocese_structure_levels',
    'pastoral_structure_templates',
    'pastoral_structure_levels',
  ]) {
    assert.match(
      sql,
      new RegExp(`before insert or update or delete on public\\.${table}`),
      `${table} debe permanecer protegido por un trigger de solo lectura`,
    )
  }

  assert.match(sql, /Hierarchical placement is canonical in structure_nodes and structure_node_edges/)
})

test('authenticated users cannot write canonical structure tables directly', async () => {
  const sql = await readRepoFile('supabase/migrations/20260710164019_route_structure_writes_through_rpcs.sql')

  for (const table of [
    'structure_templates',
    'structure_levels',
    'structure_level_edges',
    'structure_nodes',
    'structure_node_edges',
  ]) {
    assert.match(sql, new RegExp(`public\\.${table}`))
  }

  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger/)
  assert.match(sql, /from anon, authenticated/)
  assert.match(sql, /grant select/)
  assert.match(sql, /structure_template_in_scope/)
  assert.match(sql, /structures\.manage/)
})

test('canonical table policies enforce jurisdiction scope', async () => {
  const sql = await readRepoFile('supabase/migrations/20260710164040_scope_canonical_structure_table_policies.sql')

  const scopedPolicies = sql.match(/create policy structure_[a-z_]+_scoped/g) ?? []
  assert.equal(scopedPolicies.length, 15)

  assert.match(sql, /current_user_can_manage_entity\('structures\.manage', diocese_id\)/)
  assert.match(sql, /structure_template_in_scope\(template_id\)/)
  assert.doesNotMatch(sql, /current_user_has_admin_role/)
})
