import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('Playwright commands are versioned and remain outside the default check', async () => {
  const packageJson = JSON.parse(await read('package.json'))

  assert.match(packageJson.scripts['test:e2e:install'], /@playwright\/test@1\.61\.0 install chromium/)
  assert.match(packageJson.scripts['test:e2e'], /@playwright\/test@1\.61\.0/)
  assert.match(packageJson.scripts['test:e2e'], /@axe-core\/playwright@4\.10\.2/)
  assert.match(packageJson.scripts['test:e2e:public'], /public-accessibility\.spec\.mjs/)
  assert.match(packageJson.scripts['test:e2e:admin'], /admin-import\.spec\.mjs/)
  assert.match(packageJson.scripts['test:e2e:admin:mutation'], /admin-import-mixed-person\.spec\.mjs/)
  assert.doesNotMatch(packageJson.scripts.check, /e2e/)
})

test('browser configuration keeps diagnostics and local or remote execution explicit', async () => {
  const config = await read('playwright.config.mjs')

  assert.match(config, /E2E_BASE_URL/)
  assert.match(config, /testDir: '\.\/e2e'/)
  assert.match(config, /browserName: 'chromium'/)
  assert.match(config, /trace: 'retain-on-failure'/)
  assert.match(config, /screenshot: 'only-on-failure'/)
  assert.match(config, /video: 'retain-on-failure'/)
  assert.match(config, /command: 'pnpm dev'/)
})

test('public E2E checks navigation, images, headings and blocking Axe findings', async () => {
  const [spec, accessibility] = await Promise.all([
    read('e2e/public-accessibility.spec.mjs'),
    read('e2e/accessibility.mjs'),
  ])

  assert.match(spec, /path: '\/'/)
  assert.match(spec, /path: '\/diocesis'/)
  assert.match(spec, /path: '\/personas'/)
  assert.match(spec, /img:not\(\[alt\]\)/)
  assert.match(spec, /document\.activeElement/)
  assert.match(spec, /expectNoBlockingAccessibilityViolations/)
  assert.match(accessibility, /AxeBuilder/)
  assert.match(accessibility, /wcag2a/)
  assert.match(accessibility, /wcag2aa/)
  assert.match(accessibility, /critical/)
  assert.match(accessibility, /serious/)
  assert.match(accessibility, /axe-accessibility-results/)
})

test('admin import E2E uses real login but mocks the mutation endpoint', async () => {
  const spec = await read('e2e/admin-import.spec.mjs')

  assert.match(spec, /E2E_ADMIN_EMAIL/)
  assert.match(spec, /E2E_ADMIN_PASSWORD/)
  assert.match(spec, /test\.skip\(!adminEmail \|\| !adminPassword/)
  assert.match(spec, /admin\/login\?next=\/admin\/importar/)
  assert.match(spec, /api\/admin\/importaciones\/preparar/)
  assert.match(spec, /route\.fulfill/)
  assert.match(spec, /eventos-canonical-pilot\.csv/)
  assert.match(spec, /Preparar y validar lote/)
  assert.match(spec, /expectNoBlockingAccessibilityViolations/)
})

test('mixed person mutation E2E is explicit, non-production and verifies idempotency', async () => {
  const spec = await read('e2e/admin-import-mixed-person.spec.mjs')

  assert.match(spec, /E2E_ALLOW_MUTATIONS === 'true'/)
  assert.match(spec, /E2E_PERSON_REFERENCE_CODE/)
  assert.match(spec, /E2E_PERSON_FIRST_NAME/)
  assert.match(spec, /E2E_PERSON_LAST_NAME/)
  assert.match(spec, /test\.skip\(!canRun/)
  assert.match(spec, /codigo_referencia/)
  assert.match(spec, /layperson/)
  assert.match(spec, /visibilidad/)
  assert.match(spec, /internal/)
  assert.match(spec, /Aprobar lote/)
  assert.match(spec, /Aplicar lote de personas/)
  assert.match(spec, /idempotent_replay/)
  assert.match(spec, /Descargar reporte final CSV/)
})

test('Playwright artifacts and optional credentials are documented but not committed', async () => {
  const [gitignore, env, docs] = await Promise.all([
    read('.gitignore'),
    read('.env.example'),
    read('docs/PRUEBAS_E2E.md'),
  ])

  assert.match(gitignore, /playwright-report\//)
  assert.match(gitignore, /test-results\//)
  assert.match(gitignore, /blob-report\//)
  assert.match(env, /E2E_BASE_URL=/)
  assert.match(env, /E2E_ADMIN_EMAIL=/)
  assert.match(env, /E2E_ADMIN_PASSWORD=/)
  assert.match(env, /E2E_ALLOW_MUTATIONS=false/)
  assert.match(env, /E2E_PERSON_REFERENCE_CODE=/)
  assert.match(docs, /pnpm test:e2e:install/)
  assert.match(docs, /pnpm test:e2e:public/)
  assert.match(docs, /pnpm test:e2e:admin/)
  assert.match(docs, /pnpm test:e2e:admin:mutation/)
  assert.match(docs, /Nunca habilites `E2E_ALLOW_MUTATIONS=true` contra producción/)
  assert.match(docs, /No forma parte de `pnpm check`/)
})
