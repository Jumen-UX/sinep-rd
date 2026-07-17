import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

const page = await source('src/features/vida-consagrada/religious/admin/ReligiousWizardPage.tsx')
const layout = await source('src/app/(admin)/admin/nuevo/religioso/layout.tsx')
const styles = await source('src/styles/person-registration-wizard.css')

test('religious wizard owns six explicit stages without the automatic DOM observer wrapper', () => {
  assert.match(page, /import AdminWizardProgress/)
  assert.match(page, /const wizardSteps = \[/)
  assert.match(page, /\{ label: 'Tipo'/)
  assert.match(page, /\{ label: 'Revisión'/)
  assert.match(page, /maxReachableStep=\{[\s\S]*lifeType === 'priest' \? 0 : wizardSteps\.length - 1/)
  assert.doesNotMatch(layout, /AutoSectionWizard/)
  assert.match(layout, /person-registration-wizard\.css/)
  assert.match(layout, /PersonWizardContextRail/)

  const mountedSteps = page.match(/<section hidden=\{step !== [0-5]\}>/g) ?? []
  assert.equal(mountedSteps.length, 6)
  assert.doesNotMatch(page, /MutationObserver|requestSubmit|section\.hidden\s*=/)
})

test('religious wizard owns loading error success and busy semantics', () => {
  assert.match(page, /role="status" aria-live="polite">\s*Cargando asistente/)
  assert.match(page, /aria-busy=\{saving\}[\s\S]*aria-labelledby="religious-wizard-title"/)
  assert.match(page, /<h1 id="religious-wizard-title">Registrar vida consagrada<\/h1>/)
  assert.match(page, /id="religious-wizard-error"[\s\S]*role="alert"[\s\S]*aria-live="assertive"/)
  assert.match(page, /role="status"[\s\S]*aria-atomic="true"[\s\S]*aria-live="polite"/)
  assert.match(page, /<form[\s\S]*aria-busy=\{saving\}[\s\S]*aria-describedby=\{error \? 'religious-wizard-error' : undefined\}/)
})

test('religious wizard replaces placeholder-only controls with explicit labels', () => {
  assert.doesNotMatch(page, /placeholder=/)

  for (const label of [
    'Primer nombre',
    'Género',
    'Tipo de documento',
    'Número del documento',
    'Congregación, orden, instituto o comunidad',
    'Profesión religiosa',
    'Estado canónico',
    'Entidad donde sirve actualmente',
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

test('religious life type and completeness choices expose native grouped semantics', () => {
  assert.match(page, /role="group"[\s\S]*aria-label="Tipo de vida consagrada"/)
  assert.match(page, /aria-pressed=\{lifeType === 'sister'\}/)
  assert.match(page, /aria-pressed=\{lifeType === 'brother'\}/)
  assert.match(page, /aria-pressed=\{lifeType === 'consecrated_lay'\}/)
  assert.match(page, /aria-pressed=\{lifeType === 'priest'\}/)
  assert.match(page, /<legend>Identificación básica<\/legend>/)
  assert.match(page, /<legend>Documentos y contactos internos<\/legend>/)
  assert.match(page, /<legend>Asignación de cargo opcional<\/legend>/)
  assert.match(page, /<legend>Datos buscados y no encontrados<\/legend>/)
  assert.match(styles, /:is\(\.admin-lay-wizard, \.admin-religious-wizard\)/)
  assert.match(styles, /box-shadow: var\(--focus-ring\)/)
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b/i)
})

test('religious priest delegates to the canonical priest flow without a duplicate write path', () => {
  assert.match(page, /lifeType === 'priest'/)
  assert.match(page, /router\.push\('\/admin\/nuevo\/sacerdote'\)/)
  assert.match(page, /Ir al flujo de sacerdote/)
  assert.match(page, /lifeType === 'priest' \? 0 : wizardSteps\.length - 1/)
  assert.doesNotMatch(page, /saveCanonicalPersonRegistration\('priest'/)
})

test('religious wizard announces service context and preserves strict office filtering', () => {
  assert.match(page, /<strong>Servicio actual seleccionado<\/strong>/)
  assert.match(page, /<strong>Entidad del cargo seleccionada<\/strong>/)
  assert.match(page, /className="meta" role="status" aria-live="polite">\s*\{officeFilterMessage\}/)
  assert.match(page, /allowedOfficeIds\.includes\(office\.id\)/)
  assert.match(page, /disabled=\{[\s\S]*!quickEntityId \|\| filteredOfficeConfigs\.length === 0/)
  assert.match(page, /!filteredOfficeConfigs\.some\(\(office\) => office\.id === quickOfficeConfigId\)/)
  assert.match(page, /assignment_visibility: assignmentVisibility/)
})

test('religious review and navigation remain semantic and submit natively', () => {
  assert.match(page, /className="admin-review-grid"[\s\S]*aria-label="Resumen del registro de vida consagrada"/)
  assert.equal((page.match(/<article className="card compact-section">/g) ?? []).length, 3)
  assert.match(page, /className="admin-form-grid admin-wizard-actions"[\s\S]*role="group"[\s\S]*aria-label="Navegación y guardado del asistente"/)
  assert.match(page, /disabled=\{step === 0 \|\| saving\}/)
  assert.match(page, /<span aria-live="polite">[\s\S]*Paso \{step \+ 1\} de \{wizardSteps\.length\}/)
  assert.match(page, /aria-busy=\{saving\}[\s\S]*disabled=\{saving\}[\s\S]*type="submit"/)
  assert.match(page, /new FormData\(formElement\)/)
})

test('religious identity and persistence contracts remain unchanged', () => {
  assert.match(page, /PersonIdentityStep/)
  assert.match(page, /mode=\{mode\}/)
  assert.match(page, /onModeChange=\{setMode\}/)
  assert.match(page, /selected_person_id: mode === 'existing' \? selectedPersonId : null/)
  assert.match(page, /religious_life_type: lifeType/)
  assert.match(page, /saveReligious\(payload\)/)
  assert.match(page, /removeReligiousPhoto\(supabase, uploadedPhoto\?\.photo_path\)/)
  assert.match(page, /sin duplicar su identidad/)
})
