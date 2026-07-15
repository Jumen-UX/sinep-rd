import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const runbookPath = 'docs/operations/ACCESO_ADMINISTRATIVO.md'

test('administrative access runbook preserves contract order and non-production guardrails', async () => {
  const runbook = await readFile(runbookPath, 'utf8')
  const contracts = [
    'onboarding',
    'entrada administrativa',
    'validación de rol y alcance',
    'progreso de onboarding',
  ]

  let previousIndex = -1
  for (const contract of contracts) {
    const index = runbook.indexOf(contract)
    assert.ok(index > previousIndex, `${contract} debe conservar el orden de verificación`)
    previousIndex = index
  }

  assert.match(runbook, /entorno objetivo es no productivo o está autorizado/)
  assert.match(runbook, /no reutilizar credenciales personales/)
  assert.match(runbook, /Confirmar que no existen migraciones pendientes/)
})

test('runbook covers the complete profile, isolation, recovery and revocation evidence', async () => {
  const runbook = await readFile(runbookPath, 'utf8')

  for (const profile of [
    'administrador nacional',
    'administrador diocesano A',
    'administrador diocesano B',
    'usuario restringido a parroquia o unidad',
    'usuario autenticado sin rol',
    'usuario suspendido o inactivo',
    'usuario con onboarding incompleto',
  ]) {
    assert.match(runbook, new RegExp(profile))
  }

  assert.match(runbook, /puede operar dentro de su alcance y es rechazado fuera de él/)
  assert.match(runbook, /recuperación de credenciales/)
  assert.match(runbook, /Revocar o cerrar el rol/)
  assert.match(runbook, /referencias de auditoría no sensibles/)
  assert.match(runbook, /sin contraseñas/)
})
