import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const bishopWizardSource = await readFile(
  new URL('../src/features/clero/bishop/admin/BishopWizardPage.tsx', import.meta.url),
  'utf8',
)

test('bishop wizard keeps five canonical workflow stages', () => {
  for (const label of ['Origen', 'Datos básicos', 'Episcopado', 'Cargo', 'Revisión']) {
    assert.match(bishopWizardSource, new RegExp(`['"]${label}['"]`))
  }
})

test('bishop wizard preserves mounted sections and final submit semantics', () => {
  for (const step of [0, 1, 2, 3, 4]) {
    assert.match(bishopWizardSource, new RegExp(`hidden=\\{step !== ${step}\\}`))
  }
  assert.match(bishopWizardSource, /onSubmit=\{handleSubmit\}/)
  assert.match(bishopWizardSource, /Guardar obispo/)
})
