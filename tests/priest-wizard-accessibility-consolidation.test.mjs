import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

const page = await source('src/features/clero/priest/admin/PriestWizardPage.tsx')
const layout = await source('src/app/(admin)/admin/nuevo/sacerdote/layout.tsx')


test('priest wizard keeps one canonical route root', () => {
  assert.match(layout, /<div className="admin-priest-wizard">\{children\}<\/div>/)
  assert.doesNotMatch(page, /className="[^"]*admin-priest-wizard/)
  assert.match(page, /className="container dashboard-page admin-config-page"/)
})


test('priest wizard owns loading error success and busy semantics', () => {
  assert.match(page, /role="status" aria-live="polite">\s*Cargando asistente/s)
  assert.match(page, /aria-busy=\{saving\}[\s\S]*aria-labelledby="priest-wizard-title"/)
  assert.match(page, /<h1 id="priest-wizard-title">Registrar sacerdote<\/h1>/)
  assert.match(page, /id="priest-wizard-error" role="alert" aria-live="assertive"/)
  assert.match(page, /aria-atomic="true"[\s\S]*aria-live="polite"[\s\S]*role="status"/)
  assert.match(page, /<form[\s\S]*aria-busy=\{saving\}[\s\S]*aria-describedby=\{error \? 'priest-wizard-error' : undefined\}/)
  assert.doesNotMatch(page, /useRef|\.textContent\s*=/)
})


test('priest wizard groups choices and announces contextual selections', () => {
  assert.match(page, /<fieldset className="clergy-option-fieldset">[\s\S]*<legend>Tipo de sacerdote<\/legend>/)
  assert.match(page, /<legend>Datos no identificados<\/legend>/)
  assert.match(page, /<strong>Nombre visible<\/strong>/)
  assert.match(page, /<strong>Servicio seleccionado<\/strong>/)
  assert.match(page, /className="meta" role="status" aria-live="polite">\s*\{levelFilterMessage\}/)
  assert.match(page, /className="admin-review-grid" aria-label="Resumen del registro sacerdotal"/)
  assert.equal((page.match(/<article className="card compact-section">/g) ?? []).length, 4)
})


test('priest wizard exposes explicit navigation and preserves mounted steps', () => {
  assert.match(page, /className="admin-form-grid admin-wizard-actions"[\s\S]*role="group"[\s\S]*aria-label="Navegación y guardado del asistente"/)
  assert.match(page, /disabled=\{step === 0 \|\| saving\}/)
  assert.match(page, /<span aria-live="polite">\s*Paso \{step \+ 1\} de \{wizardSteps\.length\}/s)
  assert.match(page, /aria-busy=\{saving\}[\s\S]*disabled=\{saving\}[\s\S]*type="submit"/)

  const mountedSteps = page.match(/<(?:div|section) hidden=\{step !== [0-4]\}>/g) ?? []
  assert.equal(mountedSteps.length, 5)
  assert.match(page, /new FormData\(event\.currentTarget\)/)
})


test('priest wizard preserves canonical identity and office contracts', () => {
  assert.match(page, /existing_deacon_person_id: existingDeaconId \|\| null/)
  assert.match(page, /savePriest\(payload\)/)
  assert.match(page, /const filteredOfficeConfigs = quickEntityId\s*\? officeConfigs\.filter\(\(office\) => allowedOfficeIds\.includes\(office\.id\)\)\s*:\s*\[\]/)
  assert.match(page, /disabled=\{!quickEntityId \|\| filteredOfficeConfigs\.length === 0\}/)
})
