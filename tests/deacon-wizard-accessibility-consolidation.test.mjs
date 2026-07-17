import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

const page = await source('src/features/clero/deacon/admin/DeaconWizardPage.tsx')
const layout = await source('src/app/(admin)/admin/nuevo/diacono/layout.tsx')
const styles = await source('src/styles/clergy-wizard-ui.css')

test('deacon wizard owns six explicit stages without the automatic DOM observer wrapper', () => {
  assert.match(page, /import AdminWizardProgress/)
  assert.match(page, /const wizardSteps = \[/)
  assert.match(page, /\{ label: 'Origen'/)
  assert.match(page, /\{ label: 'Revisión'/)
  assert.match(page, /maxReachableStep=\{wizardSteps\.length - 1\}/)
  assert.doesNotMatch(layout, /AutoSectionWizard/)
  assert.doesNotMatch(styles, /auto-section-wizard/)

  const mountedSteps = page.match(/<section hidden=\{step !== [0-5]\}>/g) ?? []
  assert.equal(mountedSteps.length, 6)
  assert.doesNotMatch(page, /section\.hidden\s*=/)
  assert.doesNotMatch(page, /MutationObserver/)
  assert.doesNotMatch(page, /requestSubmit/)
})

test('deacon wizard owns loading error success and busy semantics', () => {
  assert.match(page, /role="status" aria-live="polite">\s*Cargando asistente/)
  assert.match(page, /aria-busy=\{saving\}[\s\S]*aria-labelledby="deacon-wizard-title"/)
  assert.match(page, /<h1 id="deacon-wizard-title">Registrar diaconado<\/h1>/)
  assert.match(page, /id="deacon-wizard-error" role="alert" aria-live="assertive"/)
  assert.match(page, /role="status" aria-atomic="true" aria-live="polite"/)
  assert.match(page, /<form[\s\S]*aria-busy=\{saving\}[\s\S]*aria-describedby=\{error \? 'deacon-wizard-error' : undefined\}/)
})

test('deacon wizard replaces placeholder-only controls with explicit labels', () => {
  assert.doesNotMatch(page, /placeholder=/)

  for (const label of [
    'Jurisdicción externa o procedencia',
    'Primer nombre',
    'Tipo de documento',
    'Número del documento',
    'País del documento',
    'Fotografía',
    'Ordenación diaconal',
    'Estado canónico',
    'Entidad donde sirve actualmente',
    'Cargo actual',
    'Notas internas de carga o verificación',
  ]) {
    assert.match(page, new RegExp(label))
  }

  assert.match(page, /autoComplete="given-name"/)
  assert.match(page, /autoComplete="family-name"/)
  assert.match(page, /autoComplete="email"/)
  assert.match(page, /autoComplete="tel"/)
})

test('deacon type and completeness choices expose native grouped semantics', () => {
  assert.match(page, /role="group" aria-label="Tipo de diácono"/)
  assert.match(page, /aria-pressed=\{deaconType === 'permanent'\}/)
  assert.match(page, /aria-pressed=\{deaconType === 'transitional'\}/)
  assert.match(page, /aria-pressed=\{deaconType === 'external'\}/)
  assert.match(page, /<legend>Documento y contacto privado<\/legend>/)
  assert.match(page, /<legend>Familia, biografía y fotografía<\/legend>/)
  assert.match(page, /<legend>Asignación rápida opcional<\/legend>/)
  assert.match(page, /<legend>Datos buscados y no encontrados<\/legend>/)
})

test('deacon wizard announces structural context and preserves strict office filtering', () => {
  assert.match(page, /<strong>Incardinación seleccionada<\/strong>/)
  assert.match(page, /<strong>Servicio actual seleccionado<\/strong>/)
  assert.match(page, /<strong>Entidad del cargo seleccionada<\/strong>/)
  assert.match(page, /className="meta" role="status" aria-live="polite">\{officeFilterMessage\}/)
  assert.match(page, /allowedOfficeIds\.includes\(office\.id\)/)
  assert.match(page, /disabled=\{!quickEntityId \|\| filteredOfficeConfigs\.length === 0\}/)
  assert.match(page, /!filteredOfficeConfigs\.some\(\(office\) => office\.id === quickOfficeConfigId\)/)
})

test('deacon review and navigation remain semantic and submit natively', () => {
  assert.match(page, /className="admin-review-grid" aria-label="Resumen del registro diaconal"/)
  assert.equal((page.match(/<article className="card compact-section">/g) ?? []).length, 3)
  assert.match(page, /className="admin-form-grid admin-wizard-actions"[\s\S]*role="group"[\s\S]*aria-label="Navegación y guardado del asistente"/)
  assert.match(page, /disabled=\{step === 0 \|\| saving\}/)
  assert.match(page, /<span aria-live="polite">Paso \{step \+ 1\} de \{wizardSteps\.length\}<\/span>/)
  assert.match(page, /aria-busy=\{saving\} disabled=\{saving\} type="submit"/)
  assert.match(page, /new FormData\(formElement\)/)
})

test('deacon canonical identity and persistence contracts remain unchanged', () => {
  assert.match(page, /PersonIdentityStep/)
  assert.match(page, /mode=\{mode\}/)
  assert.match(page, /onModeChange=\{setMode\}/)
  assert.match(page, /selected_person_id: mode === 'existing' \? selectedPersonId : null/)
  assert.match(page, /saveDeacon\(payload\)/)
  assert.match(page, /removeDeaconPhoto\(supabase, uploadedPhoto\?\.photo_path\)/)
  assert.match(page, /sin duplicar su identidad/)
})
