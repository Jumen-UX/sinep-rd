import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const runbookPath = 'docs/OPERACION_ACCESO_ADMINISTRATIVO.md'

test('administrative access runbook preserves migration order and non-production guardrails', async () => {
  const runbook = await readFile(runbookPath, 'utf8')
  const migrations = [
    '20260714051000_user_onboarding_contract.sql',
    '20260714052000_admin_entry_access_contract.sql',
    '20260714053000_validate_admin_invitation_role_scope.sql',
    '20260714054000_admin_user_onboarding_progress.sql',
  ]

  let previousIndex = -1
  for (const migration of migrations) {
    const index = runbook.indexOf(migration)
    assert.ok(index > previousIndex, `${migration} debe conservar el orden de aplicación`)
    previousIndex = index
  }

  assert.match(runbook, /Supabase no productivo/)
  assert.match(runbook, /nunca se reutilizan credenciales personales/)
  assert.match(runbook, /La prueba se detiene si falta una migración/)
})

test('runbook covers the complete profile, isolation, recovery and revocation evidence', async () => {
  const runbook = await readFile(runbookPath, 'utf8')

  for (const profile of [
    'superadministrador',
    'administrador nacional',
    'administrador diocesano A',
    'administrador diocesano B',
    'usuario restringido a parroquia o unidad',
    'usuario autenticado sin rol',
    'usuario suspendido o inactivo',
    'invitado con onboarding incompleto',
  ]) {
    assert.match(runbook, new RegExp(profile))
  }

  assert.match(runbook, /A no puede leer ni mutar registros exclusivos de B/)
  assert.match(runbook, /la respuesta no revela si el correo existe/)
  assert.match(runbook, /usar `suspended` para un bloqueo reversible o `inactive`/)
  assert.match(runbook, /actor, permiso y entidad de alcance/)
  assert.match(runbook, /No incluir secretos ni tokens/)
})
