import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(relativePath) {
  return readFile(new URL(relativePath, repoRoot), 'utf8')
}

test('root layout loads dashboard theme surfaces after public shell styles', async () => {
  const layout = await source('src/app/layout.tsx')
  const publicShellIndex = layout.indexOf("import './public-shell.css'")
  const dashboardThemeIndex = layout.indexOf("import '../styles/dashboard-theme-surfaces.css'")

  assert.ok(publicShellIndex >= 0)
  assert.ok(dashboardThemeIndex > publicShellIndex)
})

test('shared public dashboard primitives inherit semantic surfaces and text', async () => {
  const styles = await source('src/styles/dashboard-theme-surfaces.css')

  assert.match(styles, /\.dashboard-path-card\s*\{[^}]*background:\s*var\(--surface-subtle\)/s)
  assert.match(styles, /\.dashboard-path-list span,[\s\S]*\.metric-card,[\s\S]*background:\s*var\(--surface\)/s)
  assert.match(styles, /\.quick-link-card,[\s\S]*background:\s*var\(--surface-subtle\)/s)
  assert.match(styles, /\.list-row:hover,[\s\S]*background:\s*var\(--surface-hover\)/s)
  assert.match(styles, /\.metric-card strong,[\s\S]*color:\s*var\(--foreground\)/s)
  assert.match(styles, /\.metric-card span,[\s\S]*color:\s*var\(--muted\)/s)
  assert.doesNotMatch(styles, /background:\s*#(?:fff|ffffff|fbf8f1)/i)
})
