import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routeCases = [
  ['src/app/(admin)/admin/organigramas/page.tsx', /features\/organization-charts/],
  ['src/app/(admin)/admin/referencias-canonicas/cargos/page.tsx', /features\/canonical-references/],
]

const directSupabaseFrom = /\bsupabase\s*\.\s*from\s*\(/
const directSupabaseRpc = /\bsupabase\s*\.\s*rpc\s*\(/

test('final administration routes delegate to feature domains', async () => {
  for (const [path, featurePattern] of routeCases) {
    const route = await readFile(path, 'utf8')
    assert.match(route, featurePattern)
    assert.doesNotMatch(route, /createClient/)
    assert.doesNotMatch(route, directSupabaseFrom)
    assert.doesNotMatch(route, directSupabaseRpc)
    assert.doesNotMatch(route, /fetch\s*\(/)
  }
})

test('organization chart feature delegates reads to its service', async () => {
  const page = await readFile('src/features/organization-charts/admin/OrganizationChartsPage.tsx', 'utf8')
  const service = await readFile('src/features/organization-charts/services/organization-chart-admin-service.ts', 'utf8')

  assert.match(page, /loadOrganizationChartSnapshot/)
  assert.doesNotMatch(page, directSupabaseFrom)
  assert.match(service, /organization_charts/)
  assert.match(service, /organization_units/)
  assert.match(service, /position_assignments/)
})

test('canonical reference feature delegates reads to its service', async () => {
  const page = await readFile('src/features/canonical-references/admin/CanonicalOfficeReferencesPage.tsx', 'utf8')
  const service = await readFile('src/features/canonical-references/services/canonical-office-reference-admin-service.ts', 'utf8')

  assert.match(page, /loadCanonicalOfficeDefinitions/)
  assert.doesNotMatch(page, directSupabaseFrom)
  assert.match(service, /public_canonical_office_definitions/)
})
