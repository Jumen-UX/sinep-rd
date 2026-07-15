import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const resultsPath = 'docs/archive/sprints/2026-07-sprint-3-cierre.md'

test('operational results record the applied access contracts and reversible state matrix', async () => {
  const results = await readFile(resultsPath, 'utf8')

  for (const contract of [
    'onboarding',
    'entrada administrativa',
    'validación de rol y alcance',
    'progreso de onboarding',
  ]) {
    assert.match(results, new RegExp(contract))
  }

  for (const state of ['`ready`', '`onboarding`', '`blocked`', '`no_role`']) {
    assert.match(results, new RegExp(state))
  }

  assert.match(results, /La simulación terminó con `ROLLBACK`/)
  assert.match(results, /no conservó cambios de perfil ni asignaciones/)
})

test('operational results do not overstate browser or cross-diocese completion', async () => {
  const results = await readFile(resultsPath, 'utf8')

  assert.match(results, /S3-06 no se considera cerrado operativamente/)
  assert.match(results, /ejecutar Playwright contra el entorno autorizado/)
  assert.match(results, /demostrar aislamiento bidireccional entre diócesis/)
  assert.match(results, /evidencia de auditoría sin credenciales ni secretos/)
})
