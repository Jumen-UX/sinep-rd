import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrations = {
  reads: '20260728131743_scope_internal_structure_reads.sql',
  writers: '20260728131927_harden_structure_unit_writer_context.sql',
  helperExecution: '20260728132202_fix_structure_policy_helper_execution.sql',
  auditScope: '20260728132613_allow_organization_unit_audit_scope.sql',
}

async function readMigration(fileName) {
  return readFile(new URL(`supabase/migrations/${fileName}`, repoRoot), 'utf8')
}

test('repository preserves the exact applied structure authorization migration sequence', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))

  for (const fileName of Object.values(migrations)) {
    assert.equal(files.includes(fileName), true, `${fileName} must be committed`)
  }
})

test('internal structure and organization-unit reads are country scoped', async () => {
  const [reads, helpers] = await Promise.all([
    readMigration(migrations.reads),
    readMigration(migrations.helperExecution),
  ])

  assert.match(reads, /current_user_has_structure_node_scope/)
  assert.match(reads, /current_user_can_read_structure_node/)
  assert.match(reads, /rpc_definer__get_structure_node_detail_unscoped/)
  assert.match(reads, /Not authorized to view this structure node/)

  assert.match(helpers, /current_user_can_read_organization_unit/)
  assert.match(helpers, /current_user_can_read_organization_chart/)
  assert.match(helpers, /current_user_can_read_structure_template/)
  assert.match(helpers, /current_user_can_read_structure_level/)
  assert.match(helpers, /current_user_can_read_structure_edge/)
  assert.match(helpers, /using \(app_private\.current_user_can_read_organization_unit\(id\)\)/)
  assert.match(helpers, /using \(app_private\.current_user_can_read_structure_node\(id\)\)/)
  assert.match(helpers, /grant execute on function app_private\.current_user_can_read_structure_node\(uuid\) to anon, authenticated/)
  assert.doesNotMatch(helpers, /grant execute on function app_private\.current_user_can_manage_entity/)
})

test('ordinary writers reject cross-context moves and keep unscoped implementations private', async () => {
  const writers = await readMigration(migrations.writers)

  assert.match(writers, /rpc_definer__admin_save_organization_unit_unscoped/)
  assert.match(writers, /rpc_definer__admin_save_structure_template_unscoped/)
  assert.match(writers, /rpc_definer__admin_save_structure_level_unscoped/)
  assert.match(writers, /rpc_definer__admin_save_structure_node_unscoped/)
  assert.match(writers, /rpc_definer__admin_apply_organization_unit_event_unscoped/)

  assert.match(writers, /no puede trasladar una unidad a otra entidad eclesiástica/)
  assert.match(writers, /no puede trasladarse a otra diócesis/)
  assert.match(writers, /no puede trasladarse a otra plantilla/)
  assert.match(writers, /El nodo superior debe pertenecer a la misma plantilla y diócesis/)
  assert.match(writers, /La entidad vinculada pertenece a otro país/)
  assert.match(writers, /La unidad organizativa vinculada pertenece a otro país/)
  assert.match(writers, /current_user_can_manage_entity\('events\.apply', v_scope_entity_id\)/)

  assert.match(writers, /revoke all on function app_private\.rpc_definer__admin_save_structure_node_unscoped/)
  assert.match(writers, /revoke all on function app_private\.rpc_definer__admin_apply_organization_unit_event_unscoped/)
})

test('audit scope accepts the canonical organization unit dimension', async () => {
  const auditScope = await readMigration(migrations.auditScope)

  assert.match(auditScope, /audit_logs_scope_type_check/)
  assert.match(auditScope, /'organization_unit'/)
  assert.match(auditScope, /canonical replacement for legacy pastoral entity scope/)
})
