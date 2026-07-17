import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

const page = await source('src/features/personas/lay/admin/LayPersonWizardPage.tsx')
const layout = await source('src/app/(admin)/admin/nuevo/laico/layout.tsx')
const styles = await source('src/styles/person-registration-wizard.css')

test('lay person wizard owns five explicit stages without the automatic DOM observer wrapper', () => {
  assert.match(page, /import AdminWizardProgress/)
  assert.match(page, /const wizardSteps = \[/)
  assert.match(page, /\{ label: 'Origen'/)
  assert.match(page, /\{ label: 'Revisión'/)
  assert.match(page, /maxReachableStep=\{wizardSteps\.length - 1\}/)
  assert.doesNotMatch(layout, /AutoSectionWizard/)
  assert.match(layout, /person-registration-wizard\.css/)
  assert.match(layout, /PersonWizardContextRail/)

  const mountedSteps = page.match(/<section hidden=\{step !== [0-4]\}>/g) ?? []
  assert.equal(mountedSteps.length, 5)
  assert.doesNotMatch(page, /MutationObserver|requestSubmit|section\.hidden\s*=/)
})

test('lay person wizard owns loading error success and busy semantics', () => {
  assert.match(page, /role="status" aria-live="polite">\s*Cargando asistente/)
  assert.match(page, /aria-busy=\{saving\}[\s\S]*aria-labelledby="lay-wizard-title"/)
  assert.match(page, /<h1 id="lay-wizard-title">Registrar persona laica<\/h1>/)
  assert.match(page, /id="lay-wizard-error" role="alert" aria-live="assertive"/)
  assert.match(page, /role="status" aria-atomic="true" aria-live="polite"/)
  assert.match(page, /<form[\s\S]*aria-busy=\{saving\}[\s\S]*aria-describedby=\{error \? 'lay-wizard-error' : undefined\}/)
})

test('lay person wizard replaces placeholder-only controls with explicit labels', () => {
  assert.doesNotMatch(page, /placeholder=/)

  for (const label of [
    'Primer nombre',
    'Género',
    'Tipo de documento',
    'Número del documento',
    'País del documento',
    'Fotografía',
    'Biografía pública',
    'Entidad del servicio',
    'Cargo actual',
    'Visibilidad del servicio',
    'Notas internas de carga o verificación',
  ]) {
    assert.match(page, new RegExp(label))
  }

  assert.match(page, /autoComplete="given-name"/)
  assert.match(page, /autoComplete="family-name"/)
  assert.match(page, /autoComplete="email"/)
  assert.match(page, /autoComplete="tel"/)
})

test('lay person wizard groups identity and completeness choices semantically', () => {
  assert.match(page, /<legend>Identificación básica<\/legend>/)
  assert.match(page, /<legend>Documentos y contactos internos<\/legend>/)
  assert.match(page, /<legend>Datos buscados y no encontrados<\/legend>/)
  assert.match(page, /className="person-option-list person-option-list--choices"/)
  assert.match(styles, /\.person-option-fieldset/)
  assert.match(styles, /\.person-option-list--choices/)
  assert.match(styles, /box-shadow: var\(--focus-ring\)/)
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b/i)
})

test('lay person wizard announces service context and preserves strict office filtering', () => {
  assert.match(page, /<strong>Entidad seleccionada<\/strong>/)
  assert.match(page, /className="meta" role="status" aria-live="polite">\{officeFilterMessage\}/)
  assert.match(page, /allowedOfficeIds\.includes\(office\.id\)/)
  assert.match(page, /disabled=\{!quickEntityId \|\| filteredOfficeConfigs\.length === 0\}/)
  assert.match(page, /!filteredOfficeConfigs\.some\(\(office\) => office\.id === quickOfficeConfigId\)/)
  assert.match(page, /assignment_visibility: assignmentVisibility/)
})

test('lay person review and navigation remain semantic and submit natively', () => {
  assert.match(page, /className="admin-review-grid" aria-label="Resumen del registro de persona laica"/)
  assert.equal((page.match(/<article className="card compact-section">/g) ?? []).length, 3)
  assert.match(page, /className="admin-form-grid admin-wizard-actions"[\s\S]*role="group"[\s\S]*aria-label="Navegación y guardado del asistente"/)
  assert.match(page, /disabled=\{step === 0 \|\| saving\}/)
  assert.match(page, /<span aria-live="polite">Paso \{step \+ 1\} de \{wizardSteps\.length\}<\/span>/)
  assert.match(page, /aria-busy=\{saving\} disabled=\{saving\} type="submit"/)
  assert.match(page, /new FormData\(formElement\)/)
})

test('lay person identity and persistence contracts remain unchanged', () => {
  assert.match(page, /PersonIdentityStep/)
  assert.match(page, /mode=\{mode\}/)
  assert.match(page, /onModeChange=\{setMode\}/)
  assert.match(page, /selected_person_id: mode === 'existing' \? selectedPersonId : null/)
  assert.match(page, /saveLayPerson\(payload\)/)
  assert.match(page, /removeLayPersonPhoto\(supabase, uploadedPhoto\?\.photo_path\)/)
  assert.match(page, /sin crear una identidad duplicada/)
})
