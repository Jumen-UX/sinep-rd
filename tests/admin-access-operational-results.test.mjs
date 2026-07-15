import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const resultsPath = 'docs/SPRINT_3_OPERATIONAL_RESULTS.md'

test('operational results record the applied migration chain and reversible state matrix', async () => {
  const results = await readFile(resultsPath, 'utf8')

  for (const migration of [
    'user_onboarding_contract',
    'admin_entry_access_contract',
    'validate_admin_invitation_role_scope',
    'admin_user_onboarding_progress',
  ]) {
    assert.match(results, new RegExp(migration))
  }

  for (const state of ['`ready`', '`onboarding`', '`blocked`', '`no_role`']) {
    assert.match(results, new RegExp(state))
  }

  assert.match(results, /transacción terminada con `ROLLBACK`/)
  assert.match(results, /Después del rollback, la cuenta original volvió a `ready`/)
})

test('operational results do not overstate browser or cross-diocese completion', async () => {
  const results = await readFile(resultsPath, 'utf8')

  assert.match(results, /Todavía no se declara cerrado S3-06/)
  assert.match(results, /recorrido real de invitación, onboarding, login y recuperación en navegador/)
  assert.match(results, /aislamiento bidireccional entre dos diócesis/)
  assert.match(results, /no se insertan usuarios directamente en tablas del esquema `auth`/)
})
