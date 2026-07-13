import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('entity organization chart is generated from configured charts and units', async () => {
  const [chart, detail] = await Promise.all([
    readRepoFile('src/features/entidades/EntityDynamicOrganizationChart.tsx'),
    readRepoFile('src/features/entidades/EntityDetailPage.tsx'),
  ])

  assert.match(chart, /buildEntityOrganizationCharts/)
  assert.match(chart, /organization_chart_key/)
  assert.match(chart, /organization_chart_name/)
  assert.match(chart, /organization_unit_name/)
  assert.match(chart, /hierarchy_path/)
  assert.match(chart, /filter\(\(position\) => position\.is_current\)/)
  assert.match(chart, /Vacante/)
  assert.match(chart, /function PersonLink/)
  assert.match(chart, /href=\{`\/personas\/\$\{slug\}`\}/)
  assert.match(chart, /href=\{`\/entidades\/\$\{position\.direct_entity_slug\}`\}/)
  assert.match(chart, /aria-labelledby="entity-organization-chart-title"/)
  assert.match(detail, /EntityDynamicOrganizationChart/)
  assert.match(detail, /positions=\{positions\}/)
  assert.doesNotMatch(detail, /<h2>Posiciones y ocupantes<\/h2>/)
})

test('current positions expose appointment dates and succession links', async () => {
  const chart = await readRepoFile('src/features/entidades/EntityDynamicOrganizationChart.tsx')

  assert.match(chart, /predecessor_person_name/)
  assert.match(chart, /predecessor_person_slug/)
  assert.match(chart, /successor_person_name/)
  assert.match(chart, /successor_person_slug/)
  assert.match(chart, /term_start_date \?\? position\.start_date/)
  assert.match(chart, /actual_end_date \?\? position\.term_end_date/)
  assert.match(chart, /Predecesor/)
  assert.match(chart, /Sucesor/)
  assert.match(chart, /aria-label=\{`Sucesión de/)
})
