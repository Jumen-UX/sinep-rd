import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(relativePath) {
  return readFile(new URL(relativePath, repoRoot), 'utf8')
}

test('root layout resolves the persisted theme before interactive rendering', async () => {
  const layout = await source('src/app/layout.tsx')

  assert.match(layout, /suppressHydrationWarning/)
  assert.match(layout, /strategy="beforeInteractive"/)
  assert.match(layout, /localStorage\.getItem\('sinep-theme'\)/)
  assert.match(layout, /prefers-color-scheme:\s*dark/)
  assert.match(layout, /document\.documentElement\.dataset\.theme/)
  assert.match(layout, /<ThemeControl compact \/>/)
})

test('theme control persists light dark and automatic preferences', async () => {
  const control = await source('src/components/theme/ThemeControl.tsx')

  assert.match(control, /type ThemePreference = 'light' \| 'dark' \| 'system'/)
  assert.match(control, /window\.localStorage\.setItem\(THEME_STORAGE_KEY/)
  assert.match(control, /window\.matchMedia\('\(prefers-color-scheme: dark\)'\)/)
  assert.match(control, /media\.addEventListener\('change'/)
  assert.match(control, /const \[ready, setReady\] = useState\(false\)/)
  assert.match(control, /disabled=\{!ready\}/)
  assert.match(control, /applyTheme\(initialPreference, media\)\s*setReady\(true\)/)
  assert.match(control, /<option value="light">Claro<\/option>/)
  assert.match(control, /<option value="dark">Oscuro<\/option>/)
  assert.match(control, /<option value="system">Automático<\/option>/)
})

test('public and administrative shells expose the shared appearance control', async () => {
  const [layout, adminShell, publicDashboard] = await Promise.all([
    source('src/app/layout.tsx'),
    source('src/app/(admin)/admin/AdminShell.tsx'),
    source('src/features/public/PublicDashboardClient.tsx'),
  ])

  assert.match(layout, /import \{ ThemeControl \}/)
  assert.match(adminShell, /import \{ ThemeControl \}/)
  assert.match(adminShell, /<ThemeControl \/>/)
  assert.match(publicDashboard, /import \{ ThemeControl \}/)
  assert.match(publicDashboard, /public-mobile-header[\s\S]*<ThemeControl compact \/>/)
  assert.match(publicDashboard, /public-topbar[\s\S]*<ThemeControl compact \/>/)
})

test('dark theme defines semantic surfaces borders states and focus tokens', async () => {
  const [systemStyles, globalStyles] = await Promise.all([
    source('src/styles/ui-system.css'),
    source('src/app/globals.css'),
  ])

  assert.match(systemStyles, /html\[data-theme='dark'\]/)
  for (const token of [
    '--surface',
    '--text',
    '--border-info',
    '--border-success',
    '--border-warning',
    '--border-danger',
    '--border-institutional',
    '--brand-mark-text',
    '--on-primary',
    '--surface-soft',
    '--focus-ring',
  ]) {
    assert.match(systemStyles, new RegExp(`${token}:`))
  }
  assert.match(globalStyles, /html\[data-theme="dark"\]/)
  assert.match(globalStyles, /--background:\s*#111317/)
})

test('shared feedback components use theme-aware semantic borders', async () => {
  const [alert, badge] = await Promise.all([
    source('src/components/ui/alert.tsx'),
    source('src/components/ui/status-badge.tsx'),
  ])

  for (const token of ['--border-info', '--border-success', '--border-warning', '--border-danger']) {
    assert.match(alert, new RegExp(`var\\(${token}\\)`))
    assert.match(badge, new RegExp(`var\\(${token}\\)`))
  }
  assert.match(badge, /var\(--border-institutional\)/)
  assert.doesNotMatch(alert, /border-\[#[0-9a-f]{6}\]/i)
  assert.doesNotMatch(badge, /border-\[#[0-9a-f]{6}\]/i)
})

test('shared administrative module surfaces inherit the active theme', async () => {
  const moduleStyles = await source('src/styles/admin-modules.css')

  assert.match(moduleStyles, /\.admin-page-header\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.match(moduleStyles, /\.admin-workspace \.button-secondary\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.doesNotMatch(moduleStyles, /background:\s*#fff(?:fff)?;/i)
})

test('brand mark keeps a dark foreground over the institutional gold', async () => {
  const [systemStyles, publicShell] = await Promise.all([
    source('src/styles/ui-system.css'),
    source('src/app/public-shell.css'),
  ])

  assert.match(systemStyles, /--brand-mark-text:\s*#35100d/)
  assert.match(publicShell, /\.site-header \.brand-mark\s*\{[^}]*color:\s*var\(--brand-mark-text\)/s)
})

test('public accessibility workflow watches shared theme surfaces', async () => {
  const workflow = await source('.github/workflows/e2e-public.yml')

  for (const watchedPath of [
    'src/app/public-shell.css',
    'src/styles/**',
    'src/components/theme/**',
    'src/components/ui/**',
  ]) {
    assert.match(workflow, new RegExp(`- '${watchedPath.replaceAll('*', '\\*')}'`))
  }
})

test('administrative dashboard surfaces and states use semantic theme tokens', async () => {
  const [dashboard, brandedDashboard, navigation, modules] = await Promise.all([
    source('src/styles/admin-dashboard.css'),
    source('src/styles/admin-dashboard-brand.css'),
    source('src/styles/admin-navigation.css'),
    source('src/styles/admin-modules.css'),
  ])

  assert.match(dashboard, /\.admin-dashboard-topbar\s*\{[^}]*var\(--surface\)/s)
  assert.match(dashboard, /\.admin-dashboard-metric\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.match(dashboard, /\.admin-dashboard-panel\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.match(dashboard, /\.admin-dashboard-state\s*\{[^}]*background:\s*var\(--success-soft\)/s)
  assert.match(brandedDashboard, /\.admin-dashboard-review-notice\.is-clear\s*\{[^}]*var\(--success-soft\)/s)
  assert.match(brandedDashboard, /\.admin-mobile-nav\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.match(navigation, /\.admin-scope-control select\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.match(navigation, /\.admin-mobile-menu > section\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.match(modules, /\.admin-workspace \.button-primary\s*\{[^}]*color:\s*var\(--on-primary\)/s)
})

test('brand layer preserves dark surfaces instead of restoring the light gradient', async () => {
  const brand = await source('src/app/brand.css')

  assert.match(brand, /html\[data-theme='dark'\][\s\S]*background:\s*linear-gradient\([^;]*var\(--background\)/)
  assert.match(brand, /html\[data-theme='dark'\] \.site-header\s*\{[^}]*var\(--surface\)/s)
  assert.match(brand, /\.button-primary\s*\{[^}]*color:\s*var\(--on-primary\)/s)
})

test('public dashboard exposes visible theme controls and semantic surfaces', async () => {
  const dashboard = await source('src/app/public-dashboard.css')

  assert.match(dashboard, /body:has\(\.public-dashboard-layout\)\s*\{[^}]*background:\s*var\(--surface-subtle\)/s)
  assert.match(dashboard, /\.public-sidebar\s*\{[^}]*background:\s*color-mix\([^;]*var\(--surface\)/s)
  assert.match(dashboard, /\.public-panel\s*\{[^}]*background:\s*color-mix\([^;]*var\(--surface\)/s)
  assert.match(dashboard, /\.public-mobile-header\s*\{[^}]*background:\s*color-mix\([^;]*var\(--surface\)/s)
  assert.match(dashboard, /\.public-mobile-header \[data-ui='theme-control'\] select\s*\{[^}]*min-width:\s*6\.5rem/s)
})
