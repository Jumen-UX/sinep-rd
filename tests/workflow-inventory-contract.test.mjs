import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const workflowsDirectory = new URL('../.github/workflows/', import.meta.url)

const expectedWorkflows = [
  'ci.yml',
  'e2e-admin-access.yml',
  'e2e-public.yml',
]

test('the repository keeps only the canonical CI and E2E workflows', async () => {
  const workflowFiles = (await readdir(workflowsDirectory))
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .sort()

  assert.deepEqual(workflowFiles, expectedWorkflows)
})

test('canonical workflow display names remain stable', async () => {
  const workflowContents = Object.fromEntries(await Promise.all(
    expectedWorkflows.map(async (file) => [
      file,
      await readFile(new URL(file, workflowsDirectory), 'utf8'),
    ]),
  ))

  assert.match(workflowContents['ci.yml'], /^name: CI$/m)
  assert.match(workflowContents['e2e-admin-access.yml'], /^name: E2E \/ Admin access matrix$/m)
  assert.match(workflowContents['e2e-public.yml'], /^name: E2E \/ Public accessibility$/m)
})
