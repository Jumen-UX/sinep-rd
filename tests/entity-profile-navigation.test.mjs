import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('entity profile navigation exposes only available anchored sections', async () => {
  const [navigation, detail] = await Promise.all([
    readRepoFile('src/features/entidades/EntityProfileNavigation.tsx'),
    readRepoFile('src/features/entidades/EntityDetailPage.tsx'),
  ])

  assert.match(navigation, /aria-label="Secciones de la ficha institucional"/)
  assert.match(navigation, /relationshipCount/)
  assert.match(navigation, /timelineCount/)
  assert.match(navigation, /statisticsCount/)
  assert.match(navigation, /positionCount/)
  assert.match(navigation, /visibleItems/)
  assert.match(detail, /<EntityProfileNavigation/)
  assert.match(detail, /id="datos"/)
  assert.match(detail, /id="autoridad"/)
  assert.match(detail, /id="jerarquia"/)
  assert.match(detail, /id="historia"/)
  assert.match(detail, /id="estadisticas"/)
  assert.match(detail, /id="organigrama"|EntityDynamicOrganizationChart/)
})
