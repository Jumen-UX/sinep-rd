import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const healthPath = new URL('../src/app/api/health/route.ts', import.meta.url)
const robotsPath = new URL('../src/app/robots.ts', import.meta.url)

test('health endpoint verifies database availability and never caches results', async () => {
  const source = await readFile(healthPath, 'utf8')

  assert.match(source, /export const dynamic = 'force-dynamic'/)
  assert.match(source, /fetchSupabaseJson/)
  assert.match(source, /entity_types/)
  assert.match(source, /status === 'ok' \? 200 : 503/)
  assert.match(source, /'Cache-Control': 'no-store'/)
  assert.match(source, /response_time_ms/)
  assert.match(source, /checked_at/)
})

test('health endpoint remains outside public search indexing', async () => {
  const source = await readFile(robotsPath, 'utf8')

  assert.match(source, /disallow: \['\/admin\/', '\/api\/'\]/)
})
