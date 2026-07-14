import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routes = [
  'src/app/(admin)/admin/alertas/page.tsx',
  'src/app/(admin)/admin/alertas/jurisdicciones/page.tsx',
  'src/app/(admin)/admin/estado-fichas/page.tsx',
]

const featurePages = [
  'src/features/data-quality/admin/StructureAlertsPage.tsx',
  'src/features/data-quality/admin/JurisdictionAlertsPage.tsx',
  'src/features/data-quality/admin/RecordCompletenessPage.tsx',
]

test('data quality routes delegate to the data-quality feature', async () => {
  for (const path of routes) {
    const route = await readFile(path, 'utf8')

    assert.match(route, /from '@\/features\/data-quality'/)
    assert.doesNotMatch(route, /createClient/)
    assert.doesNotMatch(route, /\.from\s*\(/)
    assert.doesNotMatch(route, /\.rpc\s*\(/)
    assert.doesNotMatch(route, /fetch\s*\(/)
  }
})

test('data quality feature pages delegate persistence to their service', async () => {
  const [structureAlerts, jurisdictionAlerts, completeness] = await Promise.all(
    featurePages.map((path) => readFile(path, 'utf8')),
  )

  for (const page of [structureAlerts, jurisdictionAlerts, completeness]) {
    assert.match(page, /data-quality-admin-service/)
    assert.doesNotMatch(page, /\.from\s*\(/)
    assert.doesNotMatch(page, /\.rpc\s*\(/)
  }

  assert.match(structureAlerts, /loadStructureResponsibilityAlerts/)
  assert.match(jurisdictionAlerts, /loadJurisdictionBishopAlerts/)
  assert.match(completeness, /loadRecordCompleteness/)
  assert.match(completeness, /saveDataFieldStatus/)
})

test('data quality tables remain behind the administration service', async () => {
  const service = await readFile('src/features/data-quality/services/data-quality-admin-service.ts', 'utf8')

  assert.match(service, /admin_structure_responsibility_alerts/)
  assert.match(service, /admin_jurisdiction_bishop_alerts/)
  assert.match(service, /admin_entity_completeness/)
  assert.match(service, /admin_person_completeness/)
  assert.match(service, /data_field_statuses/)
  assert.match(service, /getAuthenticatedUserId/)
})
