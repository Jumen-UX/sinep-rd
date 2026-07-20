import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('admin dashboard delegates data loading and sign out to its service', async () => {
  const page = await read('src/features/admin/dashboard/AdminDashboardPage.tsx')
  const service = await read('src/features/admin/dashboard/admin-dashboard-service.ts')

  assert.match(page, /loadAdminDashboardData\(supabase,\s*\{/)
  assert.match(page, /activeScopeType: activeScope\?\.type \?\? null/)
  assert.match(page, /activeScopeEntityId: activeScope\?\.entityId \?\? null/)
  assert.match(page, /signOutAdminDashboard\(supabase\)/)
  assert.doesNotMatch(page, /supabase\.from\(/)
  assert.match(service, /options\.includeGlobalMetrics/)
  assert.match(service, /supabase\s*\.from\('admin_dashboard_summary'\)/)
  assert.match(service, /options\.includeActivity/)
  assert.match(service, /supabase\.from\('admin_audit_log'\)/)
})

test('admin dashboard filters actions links and metrics through canonical navigation context', async () => {
  const page = await read('src/features/admin/dashboard/AdminDashboardPage.tsx')

  assert.match(page, /useAdminNavigation\(\)/)
  assert.match(page, /destinationByHref/)
  assert.match(page, /canOperate\('\/admin\/importar'\)/)
  assert.match(page, /canOperate\('\/admin\/nuevo'\)/)
  assert.match(page, /frequentActions = actionCatalog\.filter\(\(action\) => canOperate\(action\.href\)\)/)
  assert.match(page, /activeScopeLabel/)
  assert.match(page, /Acceso de consulta/)
  assert.match(page, /groupAdminKpisByDimension\(navigation\.policyContext\)/)
  assert.match(page, /resolveAdminKpiValues/)
})

test('restricted scopes use contextual RPC and never request global KPI sources', async () => {
  const page = await read('src/features/admin/dashboard/AdminDashboardPage.tsx')
  const service = await read('src/features/admin/dashboard/admin-dashboard-service.ts')
  const values = await read('src/features/admin/dashboard/admin-kpi-value-service.ts')

  assert.match(page, /includeGlobalMetrics = activeScope\?\.isUnrestricted \?\? false/)
  assert.match(page, /setContextualKpis\(data\.contextualKpis\)/)
  assert.match(service, /if \(options\.includeGlobalMetrics\)/)
  assert.match(service, /contextualEntityScopeTypes\.has\(options\.activeScopeType\)/)
  assert.match(service, /supabase\.rpc\('get_admin_contextual_kpis'/)
  assert.match(service, /p_scope_entity_id: options\.activeScopeEntityId/)
  assert.doesNotMatch(service, /else[\s\S]*?admin_dashboard_summary/)
  assert.match(values, /source\.contextualKpis\?\.\[kpi\.id\]/)
  assert.match(values, /descendientes autorizados/i)
})

test('dashboard search delegates to the canonical internal directory', async () => {
  const page = await read('src/features/admin/dashboard/AdminDashboardPage.tsx')

  assert.match(page, /canSearch/)
  assert.match(page, /Buscar en el directorio interno/)
  assert.match(page, /\/admin\/buscar\?q=/)
  assert.doesNotMatch(page, /\/admin\/personas\?search=/)
})
