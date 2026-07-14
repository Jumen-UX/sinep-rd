import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const workflowsDirectory = new URL('../.github/workflows/', import.meta.url)

const expectedWorkflows = ['ci.yml', 'e2e-public.yml']

test('the repository keeps only the canonical CI and public E2E workflows', async () => {
  const workflowFiles = (await readdir(workflowsDirectory))
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .sort()

  assert.deepEqual(workflowFiles, expectedWorkflows)
})

test('canonical workflow display names remain stable', async () => {
  const [ciWorkflow, e2eWorkflow] = await Promise.all(
    expectedWorkflows.map((file) => readFile(new URL(file, workflowsDirectory), 'utf8')),
  )

  assert.match(ciWorkflow, /^name: CI$/m)
  assert.match(e2eWorkflow, /^name: E2E \/ Public accessibility$/m)
})
