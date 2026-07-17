import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(relativePath) {
  return readFile(new URL(relativePath, repoRoot), 'utf8')
}

test('administrative compatibility layer defines canonical legacy aliases', async () => {
  const styles = await source('src/styles/admin-theme-compatibility.css')

  for (const alias of [
    '--surface-default: var(--surface)',
    '--surface-raised: var(--surface)',
    '--surface-card: var(--surface)',
    '--border-default: var(--border)',
    '--border-color: var(--border)',
    '--brand-primary: var(--primary)',
    '--brand-secondary: var(--gold)',
    '--brand-accent: var(--gold)',
    '--brand-gold: var(--gold)',
    '--text-primary: var(--foreground)',
    '--text-secondary: var(--text-muted)',
    '--muted-foreground: var(--text-muted)',
    '--muted-text: var(--text-muted)',
  ]) {
    assert.match(styles, new RegExp(alias.replace(/[()]/g, '\\$&')))
  }

  assert.match(styles, /tbody tr:hover,[\s\S]*tbody tr:focus-within\s*\{[^}]*background:\s*var\(--surface-hover\)/s)
  assert.match(styles, /:is\(dialog, \[role='dialog'\]\)\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.match(styles, /dialog::backdrop,[\s\S]*\.admin-mobile-menu-backdrop\s*\{[^}]*rgb\(0 0 0 \/ 0\.58\)/s)
})

test('administrative layout loads compatibility rules after module styles', async () => {
  const layout = await source('src/app/(admin)/layout.tsx')
  const modulesIndex = layout.indexOf("import '@/styles/admin-modules.css'")
  const compatibilityIndex = layout.indexOf("import '@/styles/admin-theme-compatibility.css'")

  assert.ok(modulesIndex >= 0)
  assert.ok(compatibilityIndex > modulesIndex)
})

test('legacy administrative brand surfaces are overridden semantically', async () => {
  const styles = await source('src/styles/admin-theme-compatibility.css')

  assert.match(styles, /\.admin-auth-page \.auth-card\s*\{[^}]*var\(--surface\)[^}]*var\(--gold-soft\)/s)
  assert.match(styles, /\.admin-workspace \.admin-welcome-panel\s*\{[^}]*var\(--surface\)[^}]*var\(--gold-soft\)/s)
  assert.match(styles, /:is\(\.admin-quick-card, \.admin-stat-strip, \.admin-module-group, \.admin-module-card\)\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.match(styles, /\.admin-status-pill\.active, \.admin-system-card div strong\)\s*\{[^}]*background:\s*var\(--success-soft\)[^}]*color:\s*var\(--success\)/s)
  assert.match(styles, /\.admin-status-pill\.config\s*\{[^}]*background:\s*var\(--warning-soft\)[^}]*color:\s*var\(--warning\)/s)
  assert.match(styles, /\.success-box\s*\{[^}]*background:\s*var\(--success-soft\)[^}]*border-color:\s*var\(--border-success\)/s)
  assert.doesNotMatch(styles, /background:\s*#(?:fff|ffffff|fff8ea|fbf8f1)/i)
})

test('assignment manager surfaces no longer depend on light fallbacks', async () => {
  const styles = await source('src/styles/assignment-manager-ui.css')

  assert.match(styles, /\.compact-section\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.match(styles, /> \.meta\s*\{[^}]*background:\s*var\(--surface-subtle\)/s)
  assert.doesNotMatch(styles, /#fff(?:fff)?|#fbf8f1/i)
  assert.doesNotMatch(styles, /var\([^,]+,\s*#[0-9a-f]{3,6}\)/i)
})

test('deacon wizard actions preserve contrast through canonical shared styles', async () => {
  const clergyStyles = await source('src/styles/clergy-wizard-ui.css')
  const moduleStyles = await source('src/styles/admin-modules.css')
  const layout = await source('src/app/(admin)/admin/nuevo/diacono/layout.tsx')

  assert.match(layout, /clergy-wizard-ui\.css/)
  assert.match(clergyStyles, /\.admin-deacon-wizard \.auto-section-wizard__actions\s*\{[^}]*min-height:\s*4\.125rem/s)
  assert.match(clergyStyles, /\.admin-deacon-wizard \.auto-section-wizard__actions \.button\s*\{[^}]*min-height:\s*2\.75rem/s)
  assert.match(moduleStyles, /\.admin-workspace \.button-primary\s*\{[^}]*background:\s*var\(--primary\)[^}]*color:\s*var\(--on-primary\)/s)
  assert.match(moduleStyles, /\.admin-workspace \.button-secondary\s*\{[^}]*background:\s*var\(--surface\)[^}]*color:\s*var\(--foreground\)/s)
  assert.match(moduleStyles, /\.admin-workspace \.button-secondary:hover,[\s\S]*background:\s*var\(--gold-soft\)/s)
  assert.doesNotMatch(clergyStyles, /background:\s*#fff(?:fff)?/i)
})

test('office catalog uses semantic form and responsive table surfaces', async () => {
  const styles = await source('src/app/(admin)/admin/cargos/page.module.css')

  assert.match(styles, /\.officeForm input,[\s\S]*background:\s*var\(--surface\)/s)
  assert.match(styles, /\.officeCheckbox\s*\{[^}]*background:\s*var\(--surface-subtle\)/s)
  assert.match(styles, /\.officeTable th\s*\{[^}]*background:\s*var\(--surface-soft\)/s)
  assert.match(styles, /tbody tr:hover,[\s\S]*tbody tr:focus-within\s*\{[^}]*background:\s*var\(--surface-hover\)/s)
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.officeTable tr\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.doesNotMatch(styles, /background:\s*#fff(?:fff)?/i)
})