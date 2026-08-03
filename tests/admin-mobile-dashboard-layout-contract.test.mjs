import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin dashboard mobile header keeps user search and actions inside the viewport', async () => {
  const css = await read('src/styles/admin-responsive-refinements.css')

  assert.match(css, /@media \(max-width: 900px\)/)
  assert.match(css, /\.admin-dashboard-topbar\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) auto;/s)
  assert.match(css, /\.admin-dashboard-search\s*\{[^}]*grid-column: 1 \/ -1;[^}]*width: 100%;/s)
  assert.match(css, /\.admin-dashboard-user\s*\{[^}]*grid-column: 1 \/ -1;[^}]*justify-self: stretch;/s)
  assert.match(css, /\.admin-dashboard-heading\s*\{[^}]*flex-direction: column;/s)
  assert.match(css, /\.admin-dashboard-heading-actions\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/s)
})

test('narrow admin dashboard stacks actions and reserves space for mobile navigation', async () => {
  const css = await read('src/styles/admin-responsive-refinements.css')

  assert.match(css, /@media \(max-width: 620px\)/)
  assert.match(css, /\.admin-dashboard-heading-actions\s*\{\s*grid-template-columns: 1fr;/s)
  assert.match(css, /\.admin-workspace\s*\{[^}]*padding: 0 20px 96px;/s)
  assert.match(css, /\.admin-dashboard-search input\s*\{[^}]*font-size: 16px;/s)
})

test('accessibility trigger clears the administrative mobile navigation', async () => {
  const css = await read('src/styles/accessibility-tools.css')

  assert.match(css, /body:has\(\.admin-area\) \.accessibility-tools\s*\{\s*bottom: calc\(7rem \+ env\(safe-area-inset-bottom\)\);/s)
})
