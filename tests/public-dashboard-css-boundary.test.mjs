import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')
const dashboardStyles = [
  'public-combobox.css',
  'public-dashboard.css',
  'public-territorial.css',
]

test('dashboard-only styles stay out of the root layout and load on the public home route', async () => {
  const [rootLayout, publicHome, performanceAudit] = await Promise.all([
    readRepoFile('src/app/layout.tsx'),
    readRepoFile('src/app/(public)/page.tsx'),
    readRepoFile('scripts/audit-web-performance.mjs'),
  ])

  for (const style of dashboardStyles) {
    assert.doesNotMatch(rootLayout, new RegExp(`['"]\\./${style.replace('.', '\\.')}['"]`))
    assert.match(publicHome, new RegExp(`['"]\\.\\./${style.replace('.', '\\.')}['"]`))
    assert.match(performanceAudit, new RegExp(`['"]${style.replace('.', '\\.')}['"]`))
  }

  const importPositions = dashboardStyles.map((style) => publicHome.indexOf(`../${style}`))
  assert.deepEqual(importPositions, [...importPositions].sort((left, right) => left - right))
  assert.equal(importPositions.every((position) => position >= 0), true)
  assert.match(performanceAudit, /public-dashboard-route-scoped-css/)
  assert.match(performanceAudit, /routeStyles: dashboardRouteStyles/)
})

test('administrative brand styles load only inside the admin route group', async () => {
  const [rootLayout, adminLayout, publicOverrides] = await Promise.all([
    readRepoFile('src/app/layout.tsx'),
    readRepoFile('src/app/(admin)/layout.tsx'),
    readRepoFile('src/app/public-brand-overrides.css'),
  ])

  assert.doesNotMatch(rootLayout, /['"]\.\/admin-brand\.css['"]/)
  assert.match(rootLayout, /['"]\.\/public-brand-overrides\.css['"]/)
  assert.match(adminLayout, /['"]\.\.\/admin-brand\.css['"]/)

  for (const selector of [
    '.home-hero-panel',
    '.home-view-card:hover',
    '.home-warning-note',
  ]) {
    assert.match(publicOverrides, new RegExp(selector.replaceAll('.', '\\.')))
  }
})
