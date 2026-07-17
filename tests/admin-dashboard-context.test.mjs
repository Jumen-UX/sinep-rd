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

  assert.match(page, /loadAdminDashboardData\(supabase, \{ includeGlobalMetrics, includeActivity \}\)/)
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

test('restricted scopes never request global KPI sources', async () => {
  const page = await read('src/features/admin/dashboard/AdminDashboardPage.tsx')
  const service = await read('src/features/admin/dashboard/admin-dashboard-service.ts')
  const values = await read('src/features/admin/dashboard/admin-kpi-value-service.ts')

  assert.match(page, /includeGlobalMetrics = activeScope\?\.isUnrestricted \?\? false/)
  assert.match(service, /if \(options\.includeGlobalMetrics\)/)
  assert.doesNotMatch(service, /summaryResponse[\s\S]*?options\.includeGlobalMetrics[^\s\S]/)
  assert.match(values, /if \(!isUnrestricted\)/)
  assert.match(values, /agregación segura para este alcance todavía no está disponible/i)
  assert.doesNotMatch(values, /isUnrestricted \? false : true/)
})

test('dashboard search accurately describes and routes to the people directory only', async () => {
  const page = await read('src/features/admin/dashboard/AdminDashboardPage.tsx')

  assert.match(page, /Buscar personas/)
  assert.match(page, /\/admin\/personas\?search=/)
  assert.doesNotMatch(page, /Buscar personas, entidades o documentos/)
})
