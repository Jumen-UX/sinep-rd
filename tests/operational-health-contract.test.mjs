import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const healthPath = new URL('../src/app/api/health/route.ts', import.meta.url)
const robotsPath = new URL('../src/app/robots.ts', import.meta.url)

test('health endpoint verifies database availability and never caches results', async () => {
  const source = await readFile(healthPath, 'utf8')

  assert.match(source, /export const dynamic = 'force-dynamic'/)
  assert.match(source, /export const runtime = 'nodejs'/)
  assert.match(source, /probeSupabaseRestAvailability/)
  assert.match(source, /application: 'ok'/)
  assert.match(source, /status === 'ok' \? 200 : 503/)
  assert.match(source, /'Cache-Control': 'no-store, max-age=0'/)
  assert.match(source, /'X-Request-Id': requestId/)
  assert.match(source, /randomUUID\(\)/)
  assert.match(source, /response_time_ms/)
  assert.match(source, /checked_at/)
})

test('degraded health logging exposes correlation and status without dependency details', async () => {
  const source = await readFile(healthPath, 'utf8')

  assert.match(source, /event: 'health_check_degraded'/)
  assert.match(source, /request_id: requestId/)
  assert.doesNotMatch(source, /SupabaseRestError|details|endpoint|process\.env/)
})

test('health endpoint remains outside public search indexing', async () => {
  const source = await readFile(robotsPath, 'utf8')

  assert.match(source, /disallow: \['\/admin\/', '\/api\/'\]/)
})
