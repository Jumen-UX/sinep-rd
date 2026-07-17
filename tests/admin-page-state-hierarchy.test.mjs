import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('shared page state distinguishes loading error and empty feedback', async () => {
  const component = await read('src/components/ui/page-state.tsx')

  assert.match(component, /PageStateKind = 'loading' \| 'error' \| 'empty'/)
  assert.match(component, /<Alert tone="danger"/)
  assert.match(component, /aria-live="assertive"/)
  assert.match(component, /aria-busy=\{kind === 'loading'/)
  assert.match(component, /<EmptyState/)
})

test('request administration uses canonical header states badges and heading hierarchy', async () => {
  const page = await read('src/features/requests/admin/RequestsPage.tsx')

  assert.match(page, /<PageHeader/)
  assert.match(page, /breadcrumbs=\{\[\{ label: 'Administración'/)
  assert.match(page, /<PageState compact kind="loading"/)
  assert.match(page, /<PageState kind="error"/)
  assert.match(page, /<PageState kind="empty"/)
  assert.match(page, /<StatusBadge/)
  assert.match(page, /<h2 id="public-suggestions-heading"/)
  assert.match(page, /<h3>\{item\.title\}<\/h3>/)
  assert.doesNotMatch(page, /className="page-heading"/)
  assert.doesNotMatch(page, /className="empty-state"/)
  assert.doesNotMatch(page, /className="error-box"/)
  assert.doesNotMatch(page, /className="role-pill"/)
})

test('administrative activity uses canonical page feedback and one heading hierarchy', async () => {
  const page = await read('src/features/audit/admin/AdministrativeActivityPage.tsx')

  assert.match(page, /<PageHeader/)
  assert.match(page, /label: 'Configuración', href: '\/admin\/configuracion'/)
  assert.match(page, /kind="loading"/)
  assert.match(page, /kind="error"/)
  assert.match(page, /kind="empty"/)
  assert.match(page, /<StatusBadge/)
  assert.match(page, /<h2 id="activity-list-heading"/)
  assert.match(page, /<h3>\{readableAction\(row\.action\)\}<\/h3>/)
  assert.doesNotMatch(page, /className="admin-topbar"/)
  assert.doesNotMatch(page, /className="empty-state"/)
  assert.doesNotMatch(page, /className="error-box"/)
  assert.doesNotMatch(page, /className="button button-secondary"/)
})
