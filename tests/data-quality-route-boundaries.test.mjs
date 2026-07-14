import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routes = [
  'src/app/(admin)/admin/alertas/page.tsx',
  'src/app/(admin)/admin/alertas/jurisdicciones/page.tsx',
  'src/app/(admin)/admin/estado-fichas/page.tsx',
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

test('data quality workflows remain inside the feature', async () => {
  const [structureAlerts, jurisdictionAlerts, completeness] = await Promise.all([
    readFile('src/features/data-quality/admin/StructureAlertsPage.tsx', 'utf8'),
    readFile('src/features/data-quality/admin/JurisdictionAlertsPage.tsx', 'utf8'),
    readFile('src/features/data-quality/admin/RecordCompletenessPage.tsx', 'utf8'),
  ])

  assert.match(structureAlerts, /admin_structure_responsibility_alerts/)
  assert.match(jurisdictionAlerts, /admin_jurisdiction_bishop_alerts/)
  assert.match(completeness, /admin_entity_completeness/)
  assert.match(completeness, /admin_person_completeness/)
  assert.match(completeness, /data_field_statuses/)
})
