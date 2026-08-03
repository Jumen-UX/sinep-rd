import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('admin layout loads responsive refinements after theme compatibility', async () => {
  const layout = await read('src/app/(admin)/layout.tsx')
  const themeIndex = layout.indexOf("@/styles/admin-theme-compatibility.css")
  const responsiveIndex = layout.indexOf("@/styles/admin-responsive-refinements.css")

  assert.ok(themeIndex >= 0)
  assert.ok(responsiveIndex > themeIndex)
})

test('admin dashboard protects long scope labels and KPI notes', async () => {
  const styles = await read('src/styles/admin-responsive-refinements.css')

  assert.match(styles, /\.admin-scope-control strong,[\s\S]*overflow-wrap: anywhere/)
  assert.match(styles, /\.admin-scope-control select[\s\S]*text-overflow: ellipsis/)
  assert.match(styles, /\.admin-dashboard-metric-note[\s\S]*grid-column: 1 \/ -1/)
  assert.match(styles, /\.admin-dashboard-metric-note[\s\S]*white-space: normal/)
})

test('admin dashboard uses compact executive density without leaving partial KPI rows', async () => {
  const styles = await read('src/styles/admin-responsive-refinements.css')

  assert.match(styles, /\.admin-redesign\s*\{[\s\S]*grid-template-columns: 244px minmax\(0, 1fr\)/)
  assert.match(styles, /\.admin-dashboard-heading h1\s*\{[\s\S]*clamp\(30px, 3vw, 40px\)/)
  assert.match(styles, /\.admin-dashboard-metrics\s*\{[\s\S]*repeat\(auto-fit, minmax\(220px, 1fr\)\)/)
  assert.match(styles, /\.admin-dashboard-metric\s*\{[\s\S]*min-height: 118px/)
  assert.match(styles, /\.admin-dashboard-panel\s*\{[\s\S]*padding: 18px/)
})

test('admin dashboard becomes single-column and keeps touch targets on small screens', async () => {
  const styles = await read('src/styles/admin-responsive-refinements.css')

  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*\.admin-dashboard-metrics\s*\{[\s\S]*grid-template-columns: 1fr/)
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*min-height: 44px/)
  assert.match(styles, /@media \(max-width: 390px\)/)
})
