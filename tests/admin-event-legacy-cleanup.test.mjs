import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const adminLayout = await readFile('src/app/(admin)/layout.tsx', 'utf8')
const sharedEventStyles = await readFile('src/styles/admin-event-workflows.css', 'utf8')
const actionPlanStyles = await readFile('src/styles/admin-event-action-plan.css', 'utf8')
const verificationStyles = await readFile('src/styles/admin-event-verification.css', 'utf8')
const structureStyles = await readFile('src/styles/admin-structure-workflows.css', 'utf8')

test('obsolete embedded theme cleanup is no longer loaded or present', async () => {
  assert.doesNotMatch(adminLayout, /admin-embedded-theme-cleanup\.css/)
  await assert.rejects(
    readFile('src/styles/admin-embedded-theme-cleanup.css', 'utf8'),
    (error) => error instanceof Error && 'code' in error && error.code === 'ENOENT',
  )
})

test('canonical event workflow styles remain loaded', () => {
  assert.match(adminLayout, /admin-event-workflows\.css/)
  assert.match(adminLayout, /admin-event-action-plan\.css/)
  assert.match(adminLayout, /admin-event-verification\.css/)

  assert.match(sharedEventStyles, /\.event-assistant-page/)
  assert.match(sharedEventStyles, /\.pending-events-page/)
  assert.match(actionPlanStyles, /\.event-action-plan-page/)
  assert.match(actionPlanStyles, /\.event-application-contract-page/)
  assert.match(verificationStyles, /\.event-workflow-verification-page/)
})

test('canonical structural styles own the selectors formerly left in cleanup', () => {
  assert.match(adminLayout, /admin-structure-workflows\.css/)
  assert.match(structureStyles, /\.level-office-page/)
  assert.match(structureStyles, /\.level-office-row/)
  assert.match(structureStyles, /\.level-office-summary/)
  assert.match(structureStyles, /\.structure-selector/)
  assert.match(structureStyles, /\.structure-selector-path/)
  assert.doesNotMatch(structureStyles, /!important/)
})
