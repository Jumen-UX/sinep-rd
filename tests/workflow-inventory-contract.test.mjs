import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const workflowsDirectory = new URL('../.github/workflows/', import.meta.url)

const expectedWorkflows = [
  'ci.yml',
  'e2e-admin-access.yml',
  'e2e-public.yml',
]

async function readWorkflow(file) {
  return readFile(new URL(file, workflowsDirectory), 'utf8')
}

test('the repository keeps only the canonical CI and E2E workflows', async () => {
  const workflowFiles = (await readdir(workflowsDirectory))
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .sort()

  assert.deepEqual(workflowFiles, expectedWorkflows)
})

test('canonical workflow display names remain stable', async () => {
  const workflowContents = Object.fromEntries(await Promise.all(
    expectedWorkflows.map(async (file) => [file, await readWorkflow(file)]),
  ))

  assert.match(workflowContents['ci.yml'], /^name: CI$/m)
  assert.match(workflowContents['e2e-admin-access.yml'], /^name: E2E \/ Admin access matrix$/m)
  assert.match(workflowContents['e2e-public.yml'], /^name: E2E \/ Public accessibility$/m)
})

test('manual authenticated access validation fails closed without protected profiles', async () => {
  const accessWorkflow = await readWorkflow('e2e-admin-access.yml')

  assert.match(accessWorkflow, /E2E_ACCESS_PROFILES_JSON: \$\{\{ secrets\.E2E_ACCESS_PROFILES_JSON \}\}/)
  assert.match(accessWorkflow, /GITHUB_EVENT_NAME.*workflow_dispatch/)
  assert.match(accessWorkflow, /::error::Configure the protected E2E_ACCESS_PROFILES_JSON secret/)
  assert.match(accessWorkflow, /exit 1/)
  assert.match(accessWorkflow, /Authenticated matrix skipped on push/)
})

test('authenticated access workflow installs Playwright in the project before running tests', async () => {
  const accessWorkflow = await readWorkflow('e2e-admin-access.yml')

  assert.match(accessWorkflow, /pnpm add --save-dev --lockfile=false @playwright\/test@1\.61\.0/)
  assert.match(accessWorkflow, /pnpm exec playwright install chromium --with-deps/)
  assert.match(accessWorkflow, /pnpm exec playwright test e2e\/admin-access-matrix\.spec\.mjs/)
  assert.doesNotMatch(accessWorkflow, /pnpm test:e2e:access/)
})
