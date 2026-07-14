import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('request queue route delegates to the requests feature', async () => {
  const route = await read('src/app/(admin)/admin/solicitudes/page.tsx')
  const featurePage = await read('src/features/requests/admin/RequestsPage.tsx')
  const service = await read('src/features/requests/services/request-admin-service.ts')

  assert.match(route, /from '@\/features\/requests'/)
  assert.doesNotMatch(route, /createClient/)
  assert.doesNotMatch(route, /\.from\s*\(/)
  assert.doesNotMatch(route, /\.rpc\s*\(/)
  assert.match(featurePage, /loadRequestQueue/)
  assert.match(service, /admin_pending_change_requests/)
  assert.match(service, /admin_public_change_suggestions/)
})
