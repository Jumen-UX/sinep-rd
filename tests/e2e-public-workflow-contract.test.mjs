import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workflowPath = new URL('../.github/workflows/e2e-public.yml', import.meta.url)

test('public E2E workflow runs Chromium and Axe without privileged credentials', async () => {
  const workflow = await readFile(workflowPath, 'utf8')

  assert.match(workflow, /name: E2E \/ Public accessibility/)
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /paths:/)
  assert.match(workflow, /pnpm add --save-dev --lockfile=false @playwright\/test@1\.61\.0 @axe-core\/playwright@4\.10\.2/)
  assert.match(workflow, /pnpm exec playwright install chromium --with-deps/)
  assert.match(workflow, /pnpm exec playwright test e2e\/public-accessibility\.spec\.mjs e2e\/visual-evidence\.spec\.mjs/)
  assert.doesNotMatch(workflow, /--update-snapshots/)
  assert.match(workflow, /E2E_PUBLIC_INDEXING_MODE.*disabled/)
  assert.match(workflow, /indexing:\s*\n\s+- disabled\s*\n\s+- enabled/)
  assert.match(workflow, /E2E_PUBLIC_INDEXING_MODE: \$\{\{ matrix\.indexing \}\}/)
  assert.match(workflow, /PUBLIC_INDEXING_ENABLED: \$\{\{ matrix\.indexing == 'enabled'/)
  assert.match(workflow, /uses:\s+actions\/upload-artifact@v\d+/)
  assert.match(workflow, /if: always\(\)/)
  assert.match(workflow, /timeout-minutes: 20/)
  assert.doesNotMatch(workflow, /SERVICE_ROLE/)
  assert.doesNotMatch(workflow, /E2E_ALLOW_MUTATIONS/)
  assert.doesNotMatch(workflow, /test:e2e:admin/)
})

test('public E2E workflow is bounded to browser and public UI changes', async () => {
  const workflow = await readFile(workflowPath, 'utf8')

  assert.match(workflow, /e2e\/\*\*/)
  assert.match(workflow, /playwright\.config\.mjs/)
  assert.match(workflow, /src\/features\/public\/\*\*/)
  assert.match(workflow, /src\/lib\/public\/\*\*/)
  assert.match(workflow, /src\/features\/access\/admin\/AdminLoginPage\.tsx/)
  assert.match(workflow, /src\/features\/access\/admin\/RequestPasswordRecoveryPage\.tsx/)
  assert.match(workflow, /concurrency:/)
  assert.match(workflow, /cancel-in-progress: true/)
})
