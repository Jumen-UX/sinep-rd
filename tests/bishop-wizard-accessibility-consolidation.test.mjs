import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

const page = await source('src/features/clero/bishop/admin/BishopWizardPage.tsx')
const styles = await source('src/styles/clergy-wizard-ui.css')

test('bishop wizard owns loading error success and busy semantics', () => {
  assert.match(page, /role="status" aria-live="polite">Cargando asistente/)
  assert.match(page, /aria-busy=\{saving\}[\s\S]*aria-labelledby="bishop-wizard-title"/)
  assert.match(page, /<h1 id="bishop-wizard-title">Registrar obispo<\/h1>/)
  assert.match(page, /id="bishop-wizard-error" role="alert" aria-live="assertive"/)
  assert.match(page, /role="status" aria-atomic="true" aria-live="polite"/)
  assert.match(page, /<form[\s\S]*aria-busy=\{saving\}[\s\S]*aria-describedby=\{error \? 'bishop-wizard-error' : undefined\}/)
})

test('bishop wizard replaces placeholder-only controls with explicit labels', () => {
  assert.doesNotMatch(page, /placeholder=/)

  for (const label of [
    'Primer nombre',
    'Nombre visible',
    'Lugar de ordenación episcopal',
    'Incardinación o pertenencia actual',
    'Consagrante principal registrado',
    'Función episcopal',
    'Estado canónico',
    'Jurisdicción o entidad de la función',
    'Cargo configurado',
    'URL de la fuente',
  ]) {
    assert.match(page, new RegExp(label))
  }

  assert.match(page, /autoComplete="given-name"/)
  assert.match(page, /autoComplete="family-name"/)
  assert.match(page, /name="source_url" type="url"/)
})

test('bishop wizard groups succession and dignity choices semantically', () => {
  assert.match(page, /<fieldset className="clergy-option-fieldset">[\s\S]*<legend>Sucesión apostólica<\/legend>/)
  assert.match(page, /<legend>Dignidades o tratamientos<\/legend>/)
  assert.match(page, /className="clergy-option-list clergy-option-list--choices"/)
  assert.match(page, /type="checkbox" checked=\{dignities\.includes\(option\.value\)\}/)

  assert.match(styles, /\.clergy-option-fieldset\s*\{[^}]*border:\s*1px solid var\(--border\)/s)
  assert.match(styles, /\.clergy-option-fieldset legend\s*\{[^}]*color:\s*var\(--foreground\)/s)
  assert.match(styles, /\.clergy-option-list--choices\s*\{[^}]*grid-template-columns:/s)
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}\b/i)
})

test('bishop wizard announces contextual placement and exposes explicit navigation', () => {
  assert.match(page, /<strong>Ruta seleccionada<\/strong>/)
  assert.match(page, /className="meta" role="status" aria-live="polite">\{officeFilterMessage\}/)
  assert.match(page, /className="admin-form-grid admin-wizard-actions" role="group" aria-label="Navegación y guardado del asistente"/)
  assert.match(page, /disabled=\{step === 0 \|\| saving\}/)
  assert.match(page, /<span aria-live="polite">Paso \{step \+ 1\} de \{steps\.length\}<\/span>/)
  assert.match(page, /aria-busy=\{saving\} disabled=\{saving\} type="submit"/)
})

test('bishop wizard keeps all five canonical steps mounted for final FormData', () => {
  const mountedSteps = page.match(/<(?:div|section) hidden=\{step !== [0-4]\}>/g) ?? []

  assert.equal(mountedSteps.length, 5)
  assert.doesNotMatch(page, /\{step === [0-4] && \(/)
  assert.match(page, /new FormData\(event\.currentTarget\)/)
})
