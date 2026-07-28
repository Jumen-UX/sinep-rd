import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrations = {
  audit: '20260728193430_scope_audit_and_generic_units_by_country.sql',
  auditGrant: '20260728193615_grant_scoped_audit_read.sql',
  documents: '20260728193829_scope_search_and_documents_by_country.sql',
  rpcGrants: '20260728193923_grant_scoped_search_document_rpc_helpers.sql',
  reports: '20260728194100_scope_admin_reports_by_country.sql',
  pastoralDocuments: '20260728194950_support_pastoral_document_roots.sql',
  escalationFix: '20260728195113_prevent_pastoral_scope_entity_escalation.sql',
  documentRls: '20260728200434_consolidate_document_select_rls.sql',
}

async function readMigration(fileName) {
  return readFile(new URL(`supabase/migrations/${fileName}`, repoRoot), 'utf8')
}

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`)
  assert.notEqual(start, -1, `${functionName} must exist`)
  const end = source.indexOf('create or replace function', start + functionName.length + 20)
  return source.slice(start, end === -1 ? source.length : end)
}

test('repository keeps the exact applied scoped admin data migration sequence', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))
  for (const fileName of Object.values(migrations)) {
    assert.equal(files.includes(fileName), true, `${fileName} must be committed`)
  }
})

test('audit records are scoped and cannot be written directly by clients', async () => {
  const migration = await readMigration(migrations.audit)
  const grant = await readMigration(migrations.auditGrant)
  const listBody = functionBody(migration, 'app_private.admin_list_recent_audit_logs')
  const writeBody = functionBody(migration, 'app_private.rpc_definer__admin_write_audit_log')

  assert.match(migration, /function app_private\.current_user_can_manage_country/)
  assert.match(migration, /function app_private\.current_user_can_manage_organization_unit/)
  assert.match(migration, /function app_private\.current_user_can_manage_audit_log/)
  assert.match(migration, /create policy audit_logs_select_scoped/)
  assert.match(migration, /revoke insert, update, delete on table public\.audit_logs from anon, authenticated/)
  assert.match(migration, /revoke all on function public\.create_audit_log/)
  assert.match(listBody, /current_user_can_manage_audit_log\('audit\.view'/)
  assert.match(writeBody, /current_user_can_manage_country/)
  assert.match(writeBody, /current_user_can_manage_organization_unit/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national/)
  assert.match(grant, /grant select on table public\.audit_logs to authenticated/)
  assert.doesNotMatch(grant, /grant (insert|update|delete)/)
})

test('search results derive visible titles and subtitles from scoped helpers', async () => {
  const migration = await readMigration(migrations.documents)
  const peopleBody = functionBody(migration, 'app_private.admin_list_people')
  const searchBody = functionBody(migration, 'app_private.admin_search_catalog')

  assert.match(peopleBody, /current_user_can_manage_person\('people\.view'/)
  assert.match(peopleBody, /current_user_can_manage_organization_unit/)
  assert.match(peopleBody, /current_user_can_manage_entity\('people\.view'/)
  assert.match(searchBody, /current_user_can_manage_entity\('entities\.view'/)
  assert.match(searchBody, /current_user_can_manage_organization_unit\('pastorals\.view'/)
  assert.doesNotMatch(searchBody, /current_user_has_scope_access|current_user_is_super_or_national/)
})

test('documents resolve entity and unit scopes and expose only read RPCs', async () => {
  const migration = await readMigration(migrations.documents)
  const pastoral = await readMigration(migrations.pastoralDocuments)
  const grants = await readMigration(migrations.rpcGrants)
  const finalRls = await readMigration(migrations.documentRls)
  const reader = functionBody(pastoral, 'app_private.rpc_definer__admin_list_documents')

  for (const helper of [
    'app_private.document_scope_entities',
    'app_private.document_scope_units',
    'app_private.current_user_can_manage_document',
    'app_private.current_user_can_view_document',
  ]) {
    assert.match(migration, new RegExp(`function ${helper.replaceAll('.', '\\.')}`))
  }

  assert.match(migration, /revoke insert, update, delete on table public\.documents from anon, authenticated/)
  assert.match(reader, /v_scope_kind = 'organization_unit'/)
  assert.match(reader, /v_scope_kind = 'pastoral_area'/)
  assert.match(reader, /organization_unit_in_scope/)
  assert.match(reader, /current_user_can_view_document/)
  assert.match(grants, /grant execute on function app_private\.rpc_definer__admin_list_documents/)
  assert.match(finalRls, /create policy documents_select_public_anon/)
  assert.match(finalRls, /to anon/)
  assert.match(finalRls, /create policy documents_select_authenticated/)
  assert.match(finalRls, /to authenticated/)
  assert.match(finalRls, /or app_private\.current_user_can_view_document/)
  assert.doesNotMatch(finalRls, /to anon, authenticated/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national/)
})

test('pastoral assignments cannot escalate through their backing entity', async () => {
  const migration = await readMigration(migrations.escalationFix)
  const unitBody = functionBody(migration, 'app_private.current_user_can_manage_organization_unit')
  const calendarBody = functionBody(migration, 'app_private.current_user_can_manage_calendar_unit')

  assert.match(unitBody, /assignment\.organization_unit_id is null/)
  assert.match(unitBody, /assignment\.pastoral_area_id is null/)
  assert.match(unitBody, /v_has_territorial_assignment/)
  assert.match(unitBody, /assignment\.organization_unit_id in/)
  assert.match(calendarBody, /current_user_can_manage_organization_unit/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national/)
})

test('administrative reports require an authorized root and support national scope', async () => {
  const migration = await readMigration(migrations.reports)
  const kpiBody = functionBody(migration, 'app_private.rpc_definer__get_admin_contextual_kpis')
  const summaryBody = functionBody(migration, 'app_private.rpc_definer__admin_imported_appointment_review_summary')
  const reconstructionBody = functionBody(migration, 'app_private.rpc_definer__get_institutional_state_reconstruction')

  assert.match(kpiBody, /'national', 'diocese', 'parish', 'entity'/)
  assert.match(kpiBody, /current_user_can_manage_entity\('entities\.view'/)
  assert.match(kpiBody, /get_entity_descendants/)
  assert.doesNotMatch(kpiBody, /current_user_has_scope_for_entity/)
  assert.match(summaryBody, /current_user_can_manage_entity/)
  assert.match(reconstructionBody, /current_user_can_manage_entity\('events\.view'/)
  assert.match(reconstructionBody, /current_user_can_manage_organization_unit/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national/)
})
