import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readSource(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('CSV utility neutralizes spreadsheet formulas and emits UTF-8 BOM', async () => {
  const source = await readSource('src/lib/csv.ts')

  assert.match(source, /\^\[\\t\\r \]\*\[=\+\\-@\]/)
  assert.match(source, /`'\$\{normalized\}`/)
  assert.match(source, /\\uFEFF/)
  assert.match(source, /text\/csv;charset=utf-8/)
  assert.match(source, /replace\(\/\[\^a-zA-Z0-9\._-\]\+\/g/)
})

test('audit export uses only rows returned by the scoped audit RPC', async () => {
  const service = await readSource('src/features/audit/services/audit-admin-service.ts')
  const page = await readSource('src/features/audit/admin/AdministrativeActivityPage.tsx')

  assert.match(service, /rpc\('admin_list_recent_audit_logs'/)
  assert.match(service, /createAdministrativeActivityCsv/)
  assert.match(service, /downloadAdministrativeActivityCsv/)
  assert.match(service, /createCsv/)
  assert.doesNotMatch(service, /\.from\('audit_logs'\)/)
  assert.match(page, /Exportar CSV/)
  assert.match(page, /downloadAdministrativeActivityCsv\(rows\)/)
  assert.match(page, /disabled=\{loading \|\| rows\.length === 0\}/)
})

test('document service reads through the scoped RPC and never mutates document tables', async () => {
  const service = await readSource('src/features/documents/services/document-admin-service.ts')

  assert.match(service, /rpc\('admin_list_documents'/)
  assert.match(service, /p_scope_entity_id: filters\.scopeId/)
  assert.match(service, /createDocumentsCsv/)
  assert.match(service, /downloadDocumentsCsv/)
  assert.doesNotMatch(service, /\.from\('documents'\)/)
  assert.doesNotMatch(service, /\.(insert|update|delete|upsert)\(/)
  assert.doesNotMatch(service, /service_role|SUPABASE_SERVICE_ROLE/)
})

test('document directory inherits active scope and keeps uploads disabled', async () => {
  const page = await readSource('src/features/documents/admin/AdministrativeDocumentsPage.tsx')
  const route = await readSource('src/app/(admin)/admin/documentos/page.tsx')
  const featureIndex = await readSource('src/features/documents/index.ts')

  assert.match(page, /useAdminNavigation\(\)/)
  assert.match(page, /activeScope\?\.entityId/)
  assert.match(page, /loadAdministrativeDocuments/)
  assert.match(page, /downloadDocumentsCsv\(rows\)/)
  assert.match(page, /Carga de archivos temporalmente deshabilitada/)
  assert.match(page, /Solo lectura/)
  assert.doesNotMatch(page, /storage\.from|\.upload\(/)
  assert.match(route, /AdministrativeDocumentsPage as default/)
  assert.match(featureIndex, /document-admin-service/)
})

test('navigation exposes documents by permission and dashboard supports national KPIs', async () => {
  const navigation = await readSource('src/features/admin/navigation/admin-navigation-contract.ts')
  const dashboard = await readSource('src/features/admin/dashboard/admin-dashboard-service.ts')

  assert.match(navigation, /id: 'documents'/)
  assert.match(navigation, /href: '\/admin\/documentos'/)
  assert.match(navigation, /entryPermissions: \['documents\.view'\]/)
  assert.match(dashboard, /new Set\(\['national', 'diocese', 'parish', 'entity'\]\)/)
  assert.match(dashboard, /rpc\('get_admin_contextual_kpis'/)
})
