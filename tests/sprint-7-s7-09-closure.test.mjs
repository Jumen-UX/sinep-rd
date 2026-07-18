import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sprint = await readFile('docs/sprints/active/sprint-7.md', 'utf8')
const consolidation = await readFile('docs/sprints/active/sprint-7-s7-09.md', 'utf8')

test('Sprint 7 canonical queue marks S7-06 through S7-09 complete and leaves S7-10 pending', () => {
  for (const item of ['S7-06', 'S7-07', 'S7-08', 'S7-09']) {
    assert.match(sprint, new RegExp(`\\[x\\] ${item}`))
  }

  assert.match(sprint, /\[ \] S7-10/)
  assert.match(sprint, /Iniciar S7-10 por la reparación del perfil E2E autenticado/)
  assert.doesNotMatch(sprint, /cerrar S7-06 e iniciar S7-07/)
})

test('S7-09 is closed with its retired elements and controlled debt documented', () => {
  assert.match(consolidation, /> Estado: completada/)
  assert.match(consolidation, /18\. Reducción del puente global de accesibilidad/)
  assert.match(consolidation, /AutoSectionWizard\.tsx/)
  assert.match(consolidation, /LegacyAdminAccessibilityEnhancements.*permanece temporalmente/s)
  assert.match(consolidation, /S7-09 queda cerrada/)
  assert.doesNotMatch(consolidation, /Validar el decimocuarto bloque con CI/)
  assert.doesNotMatch(consolidation, /componente permanece temporalmente para laico y vida consagrada/)
})
