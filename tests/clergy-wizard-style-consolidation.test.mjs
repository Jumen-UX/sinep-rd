import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

function repoFile(path) {
  return new URL(path, repoRoot)
}

async function source(path) {
  return readFile(repoFile(path), 'utf8')
}

const layouts = {
  priest: await source('src/app/(admin)/admin/nuevo/sacerdote/layout.tsx'),
  deacon: await source('src/app/(admin)/admin/nuevo/diacono/layout.tsx'),
  bishop: await source('src/app/(admin)/admin/nuevo/obispo/layout.tsx'),
}

const sharedStyles = await source('src/styles/clergy-wizard-ui.css')
const autoSectionWizard = await source('src/components/admin/AutoSectionWizard.tsx')

const retiredStylePaths = [
  'src/styles/priest-wizard-ui.css',
  'src/styles/deacon-wizard-ui.css',
  'src/styles/deacon-wizard-polish.css',
]

test('every clergy route loads the shared wizard extension without role-specific styles', () => {
  for (const [role, layout] of Object.entries(layouts)) {
    assert.match(layout, /person-wizard-ui\.css/, `${role} must retain the person wizard foundation.`)
    assert.match(layout, /clergy-wizard-ui\.css/, `${role} must load the clergy extension.`)
    assert.doesNotMatch(layout, /(?:priest|deacon)-wizard-(?:ui|polish)\.css/)
  }

  assert.match(layouts.priest, /className="admin-priest-wizard"/)
  assert.match(layouts.deacon, /className="admin-deacon-wizard"/)
  assert.match(layouts.bishop, /className="admin-bishop-wizard person-wizard-with-context"/)
})

test('retired clergy stylesheets remain physically removed', async () => {
  for (const path of retiredStylePaths) {
    await assert.rejects(access(repoFile(path)))
  }
})

test('shared clergy styles preserve controlled and automatic wizard layouts', () => {
  assert.match(sharedStyles, /\.admin-priest-wizard, \.admin-bishop-wizard/)
  assert.match(sharedStyles, /\.admin-wizard-layout/)
  assert.match(sharedStyles, /> aside\[aria-label='Progreso del asistente'\]/)
  assert.match(sharedStyles, /\.admin-deacon-wizard \.auto-section-wizard/)
  assert.match(sharedStyles, /\.auto-section-wizard__actions/)
  assert.match(sharedStyles, /\.admin-review-grid/)
  assert.match(sharedStyles, /\.admin-wizard-success/)
  assert.match(sharedStyles, /@media \(max-width: 900px\)/)
  assert.match(sharedStyles, /@media \(max-width: 640px\)/)
  assert.match(sharedStyles, /@media \(prefers-reduced-motion: reduce\)/)
})

test('shared clergy styles use semantic tokens and the focus ring as a shadow value', () => {
  assert.match(sharedStyles, /var\(--surface\)/)
  assert.match(sharedStyles, /var\(--surface-hover\)/)
  assert.match(sharedStyles, /var\(--border\)/)
  assert.match(sharedStyles, /box-shadow: var\(--focus-ring\)/)
  assert.doesNotMatch(sharedStyles, /outline:\s*[^;]*var\(--focus-ring\)/)
  assert.doesNotMatch(sharedStyles, /#[0-9a-f]{3,8}\b/i)
})

test('deacon keeps the automatic section wizard behavior while presentation is shared', () => {
  assert.match(layouts.deacon, /<AutoSectionWizard>\{children\}<\/AutoSectionWizard>/)
  assert.match(autoSectionWizard, /readSteps\(form\)/)
  assert.match(autoSectionWizard, /section\.hidden = index !== safeStep/)
  assert.match(autoSectionWizard, /form\.requestSubmit\(submitButton\)/)
  assert.match(autoSectionWizard, /<AdminWizardProgress/)
})
