import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const packagePath = new URL('../package.json', import.meta.url)
const scriptPath = new URL('../scripts/verify-health.mjs', import.meta.url)
const runbookPath = new URL('../docs/OPERACION_Y_RECUPERACION.md', import.meta.url)
const observabilityPath = new URL('../docs/architecture/OBSERVABILITY_CONTRACT.md', import.meta.url)

test('health verifier validates application and database availability', async () => {
  const [packageSource, script] = await Promise.all([
    readFile(packagePath, 'utf8'),
    readFile(scriptPath, 'utf8'),
  ])
  const packageJson = JSON.parse(packageSource)

  assert.equal(packageJson.scripts['health:check'], 'node scripts/verify-health.mjs')
  assert.match(script, /new URL\('\/api\/health', baseUrl\)/)
  assert.match(script, /payload\?\.status !== 'ok'/)
  assert.match(script, /payload\?\.checks\?\.application !== 'ok'/)
  assert.match(script, /payload\?\.checks\?\.database !== 'ok'/)
  assert.match(script, /payload\?\.request_id !== requestId/)
  assert.match(script, /response\.headers\.get\('x-request-id'\)/)
  assert.match(script, /VERCEL_AUTOMATION_BYPASS_SECRET/)
  assert.match(script, /15_000/)
})

test('operational runbook covers monitoring incidents backups and restoration', async () => {
  const [runbook, observability] = await Promise.all([
    readFile(runbookPath, 'utf8'),
    readFile(observabilityPath, 'utf8'),
  ])

  assert.match(runbook, /## Health check/)
  assert.match(runbook, /## Monitoreo recomendado/)
  assert.match(runbook, /## Respuesta a incidentes/)
  assert.match(runbook, /## Copias de seguridad/)
  assert.match(runbook, /## Restauración/)
  assert.match(runbook, /entorno aislado/)
  assert.match(runbook, /pnpm health:check/)
  assert.match(runbook, /Playwright\/Axe/)
  assert.match(runbook, /OBSERVABILITY_CONTRACT\.md/)
  assert.doesNotMatch(runbook, /service_role|sb_secret|postgres:\/\//i)

  assert.match(observability, /X-Request-Id/)
  assert.match(observability, /health_check_degraded/)
  assert.match(observability, /cinco segundos/)
  assert.match(observability, /proveedor, el canal y los responsables/)
  assert.doesNotMatch(observability, /service_role|sb_secret|postgres:\/\//i)
})
