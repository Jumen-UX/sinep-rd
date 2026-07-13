import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('assignment catalogs expose organization unit jurisdiction', async () => {
  const service = await read('src/features/appointments/services/assignment-admin-service.ts')

  assert.match(service, /type AssignmentUnit[\s\S]*ecclesiastical_entity_id: string/)
  assert.match(service, /select\('id,name,slug,organization_chart_id,ecclesiastical_entity_id'\)/)
  assert.match(service, /\.eq\('status', 'active'\)/)
  assert.match(service, /\.eq\('is_current', true\)/)
})

test('assignment manager filters offices by chart and units by chart plus entity', async () => {
  const page = await read('src/features/appointments/admin/AssignmentManagerPage.tsx')

  assert.match(page, /selectedChartId\s*\?\s*catalogs\.configs\.filter\(\(config\) => config\.organization_chart_id === selectedChartId\)/)
  assert.match(page, /unit\.organization_chart_id === selectedChartId/)
  assert.match(page, /unit\.ecclesiastical_entity_id === selectedEntityId/)
  assert.match(page, /const \[selectedUnitId, setSelectedUnitId\] = useState\(''\)/)
  assert.match(page, /organization_unit_id: selectedUnitId \|\| null/)
  assert.match(page, /setSelectedUnitId\(''\)/)
  assert.match(page, /Las unidades se limitan al organigrama y a la entidad eclesiástica seleccionados/)
})
