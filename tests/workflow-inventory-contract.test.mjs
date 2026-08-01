import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const workflowsDirectory = new URL('../.github/workflows/', import.meta.url)

const expectedWorkflows = [
  'ci.yml',
  'e2e-admin-access.yml',
  'e2e-deprovision-access.yml',
  'e2e-provision-access.yml',
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
  assert.match(workflowContents['e2e-deprovision-access.yml'], /^name: E2E \/ Suspend QA access profiles$/m)
  assert.match(workflowContents['e2e-provision-access.yml'], /^name: E2E \/ Provision QA access profiles$/m)
  assert.match(workflowContents['e2e-public.yml'], /^name: E2E \/ Public accessibility$/m)
})

test('canonical CI validates pull requests targeting main', async () => {
  const workflow = await readWorkflow('ci.yml')

  assert.match(workflow, /pull_request:\s*\n\s+branches:\s*\n\s+- main/)
  assert.match(workflow, /name: Typecheck, tests and build/)
  assert.match(workflow, /run: pnpm check/)
})

test('manual authenticated access validation fails closed without protected profiles', async () => {
  const accessWorkflow = await readWorkflow('e2e-admin-access.yml')

  assert.match(accessWorkflow, /E2E_ACCESS_PROFILES_JSON: \$\{\{ secrets\.E2E_ACCESS_PROFILES_JSON \}\}/)
  assert.match(accessWorkflow, /GITHUB_EVENT_NAME.*workflow_dispatch/)
  assert.match(accessWorkflow, /::error::Configure the protected E2E_ACCESS_PROFILES_JSON secret/)
  assert.match(accessWorkflow, /exit 1/)
  assert.match(accessWorkflow, /Authenticated matrix skipped on push/)
})

test('authenticated access workflow validates coverage before installing Playwright', async () => {
  const accessWorkflow = await readWorkflow('e2e-admin-access.yml')
  const validationPosition = accessWorkflow.indexOf('node scripts/validate-e2e-access-profiles.mjs')
  const installPosition = accessWorkflow.indexOf('pnpm install --frozen-lockfile')

  assert.match(accessWorkflow, /e2e\/support\/access-profile-matrix\.mjs/)
  assert.match(accessWorkflow, /scripts\/validate-e2e-access-profiles\.mjs/)
  assert.ok(validationPosition >= 0, 'The protected matrix validator must be invoked.')
  assert.ok(installPosition > validationPosition, 'Profile validation must happen before dependency installation.')
})

test('authenticated access workflow installs Playwright in the project before running tests', async () => {
  const accessWorkflow = await readWorkflow('e2e-admin-access.yml')

  assert.match(accessWorkflow, /pnpm add --save-dev --lockfile=false @playwright\/test@1\.61\.0/)
  assert.match(accessWorkflow, /pnpm exec playwright install chromium --with-deps/)
  assert.match(accessWorkflow, /pnpm exec playwright test e2e\/admin-access-matrix\.spec\.mjs/)
  assert.doesNotMatch(accessWorkflow, /pnpm test:e2e:access/)
})

test('QA provisioning remains manual explicit and secret-backed', async () => {
  const provisioningWorkflow = await readWorkflow('e2e-provision-access.yml')

  assert.match(provisioningWorkflow, /^on:\s*\n\s+workflow_dispatch:/m)
  assert.match(provisioningWorkflow, /PROVISION_NON_PRODUCTION_E2E/)
  assert.match(provisioningWorkflow, /SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/)
  assert.match(provisioningWorkflow, /environment: qa/)
  assert.match(provisioningWorkflow, /retention-days: 1/)
  assert.match(provisioningWorkflow, /pnpm e2e:access:provision/)
  assert.match(provisioningWorkflow, /pnpm exec playwright test e2e\/admin-access-matrix\.spec\.mjs/)
})

test('QA suspension remains manual reversible and cannot delete Auth users', async () => {
  const suspensionWorkflow = await readWorkflow('e2e-deprovision-access.yml')

  assert.match(suspensionWorkflow, /^on:\s*\n\s+workflow_dispatch:/m)
  assert.match(suspensionWorkflow, /DEPROVISION_NON_PRODUCTION_E2E/)
  assert.match(suspensionWorkflow, /SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/)
  assert.match(suspensionWorkflow, /environment: qa/)
  assert.match(suspensionWorkflow, /E2E_ACCESS_EMAIL_DOMAIN: example\.test/)
  assert.match(suspensionWorkflow, /E2E_DEPROVISION_MODE: suspend/)
  assert.match(suspensionWorkflow, /pnpm e2e:access:deprovision/)
  assert.doesNotMatch(suspensionWorkflow, /E2E_DELETE_CONFIRM/)
  assert.doesNotMatch(suspensionWorkflow, /DELETE_NON_PRODUCTION_E2E_USERS/)
  assert.doesNotMatch(suspensionWorkflow, /E2E_DEPROVISION_MODE:\s*delete/)
})
