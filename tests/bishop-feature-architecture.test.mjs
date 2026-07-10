import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('bishop route delegates to the clergy feature domain', async () => {
  const route = await readRepoFile('src/app/(admin)/admin/nuevo/obispo/page.tsx')
  const featureIndex = await readRepoFile('src/features/clero/bishop/index.ts')

  assert.equal(route.trim(), "export { BishopWizardPage as default } from '@/features/clero/bishop'")
  assert.match(featureIndex, /BishopWizardPage/)
  assert.match(featureIndex, /bishop-admin-service/)
})

test('bishop wizard delegates persistence and scoped catalogs to typed services', async () => {
  const page = await readRepoFile('src/features/clero/bishop/admin/BishopWizardPage.tsx')

  for (const operation of ['loadBishopCatalogs', 'loadAllowedOfficeIds', 'saveBishop']) {
    assert.match(page, new RegExp(operation))
  }

  assert.doesNotMatch(page, /\.from\(/)
  assert.doesNotMatch(page, /fetch\('\/api\/admin\/obispo'/)
  assert.match(page, /Este nivel no tiene cargos configurados/)
  assert.match(page, /offices\.filter\(\(office\) => allowedOfficeIds\.includes\(office\.id\)\)/)
})

test('bishop wizard keeps every step mounted so final FormData contains prior fields', async () => {
  const page = await readRepoFile('src/features/clero/bishop/admin/BishopWizardPage.tsx')
  const mountedSteps = page.match(/<section hidden=\{step !== [0-4]\}>/g) ?? []

  assert.equal(mountedSteps.length, 5)
  assert.doesNotMatch(page, /\{step === [0-4] && \(/)
  assert.match(page, /new FormData\(event\.currentTarget\)/)
})

test('bishop service reuses shared clergy infrastructure and centralizes API access', async () => {
  const service = await readRepoFile('src/features/clero/bishop/services/bishop-admin-service.ts')

  assert.match(service, /loadClergyPlacementCatalogs/)
  assert.match(service, /loadAllowedOfficeIds/)
  assert.match(service, /from\('persons'\)/)
  assert.match(service, /fetch\('\/api\/admin\/obispo'/)
})
