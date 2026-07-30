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
  assert.doesNotMatch(layout, /ThemeControl|next\/link|site-header|site-footer/)
})

test('accessibility tools own the only visible appearance control', async () => {
  const [accessibilityTools, preferenceHook] = await Promise.all([
    source('src/components/accessibility/AccessibilityTools.tsx'),
    source('src/components/theme/useThemePreference.ts'),
  ])

  assert.match(preferenceHook, /type ThemePreference = 'light' \| 'dark' \| 'system'/)
  assert.match(preferenceHook, /window\.localStorage\.setItem\(THEME_STORAGE_KEY/)
  assert.match(preferenceHook, /window\.matchMedia\('\(prefers-color-scheme: dark\)'\)/)
  assert.match(preferenceHook, /media\.addEventListener\('change'/)
  assert.match(preferenceHook, /const \[ready, setReady\] = useState\(false\)/)
  assert.match(preferenceHook, /applyTheme\(initialPreference, media\)\s*setReady\(true\)/)

  assert.match(accessibilityTools, /useThemePreference\(\)/)
  assert.match(accessibilityTools, /\['light', 'Claro'\]/)
  assert.match(accessibilityTools, /\['dark', 'Oscuro'\]/)
  assert.match(accessibilityTools, /\['system', 'Automático'\]/)
  assert.match(accessibilityTools, /aria-pressed=\{themePreference === value\}/)
})

test('public and administrative shells expose no duplicate theme controls', async () => {
  const [publicLayout, adminShell, publicShell, publicExplorer] = await Promise.all([
    source('src/app/(public)/layout.tsx'),
    source('src/app/(admin)/admin/AdminShell.tsx'),
    source('src/features/public/PublicDashboardShell.tsx'),
    source('src/features/public/PublicDashboardExplorer.tsx'),
  ])

  for (const shell of [publicLayout, adminShell, publicShell]) {
    assert.doesNotMatch(shell, /ThemeControl|PublicDashboardThemeControl/)
  }
  assert.doesNotMatch(publicShell, /['"]use client['"]/)
  assert.match(publicExplorer, /^['"]use client['"]/)
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

test('public dashboard exposes semantic surfaces', async () => {
  const dashboard = await source('src/app/public-dashboard.css')

  assert.match(dashboard, /body:has\(\.public-dashboard-layout\)\s*\{[^}]*background:\s*var\(--surface-subtle\)/s)
  assert.match(dashboard, /\.public-sidebar\s*\{[^}]*background:\s*color-mix\([^;]*var\(--surface\)/s)
  assert.match(dashboard, /\.public-panel\s*\{[^}]*background:\s*color-mix\([^;]*var\(--surface\)/s)
  assert.match(dashboard, /\.public-mobile-header\s*\{[^}]*background:\s*color-mix\([^;]*var\(--surface\)/s)
})

test('wizard and jurisdiction surfaces use semantic colors in every theme', async () => {
  const [framework, unifiedWizard] = await Promise.all([
    source('src/styles/admin-framework.css'),
    source('src/styles/person-wizard-unified.css'),
  ])

  assert.match(framework, /\.admin-wizard-progress\{[^}]*background:var\(--surface\)/s)
  assert.match(framework, /\.admin-warning-box\{[^}]*background:var\(--warning-soft\);border-color:var\(--border-warning\)/s)
  assert.match(framework, /\.admin-info-box\{[^}]*background:var\(--info-soft\);border-color:var\(--border-info\)/s)
  assert.match(framework, /\.jurisdiction-view-tab\{[^}]*background:var\(--surface\)/s)
  assert.match(framework, /\.tree-row\{[^}]*background:var\(--surface\)/s)
  assert.doesNotMatch(framework, /background:\s*#fff(?:fff)?/i)
  assert.match(unifiedWizard, /background:\s*color-mix\(in srgb, var\(--surface\) 96%, transparent\)/)
  assert.doesNotMatch(unifiedWizard, /var\(--surface-raised,\s*#fff\)/i)
})

test('administrative configuration and entity shells inherit semantic surfaces', async () => {
  const shell = await source('src/styles/admin-shell.css')

  assert.match(shell, /\.admin-area\{[^}]*background:var\(--background\)/s)
  assert.match(shell, /\.admin-sidebar-nav a\[aria-current=page\]\{[^}]*background:var\(--gold-soft\)/s)
  assert.match(shell, /\.admin-config-page[^}]*\.metric-button\{[^}]*background:var\(--surface\)/s)
  assert.match(shell, /\.admin-config-form\.dashboard-section input,[^{]*\{[^}]*background:var\(--surface\)/s)
  assert.match(shell, /\.admin-entity-tabs\{[^}]*background:var\(--surface\)/s)
  assert.match(shell, /\.admin-completion-bar\{[^}]*background:var\(--surface-muted\)/s)
  assert.doesNotMatch(shell, /background:\s*#(?:fff|ffffff|fff8ea|fbfaf7)/i)
})
