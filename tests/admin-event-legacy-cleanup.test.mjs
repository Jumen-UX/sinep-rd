import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const adminLayout = await readFile('src/app/(admin)/layout.tsx', 'utf8')
const legacyCleanup = await readFile('src/styles/admin-embedded-theme-cleanup.css', 'utf8')
const sharedEventStyles = await readFile('src/styles/admin-event-workflows.css', 'utf8')
const actionPlanStyles = await readFile('src/styles/admin-event-action-plan.css', 'utf8')
const verificationStyles = await readFile('src/styles/admin-event-verification.css', 'utf8')

const retiredEventSelectors = [
  'events-page',
  'event-assistant-page',
  'event-review-page',
  'event-action-plan-page',
  'event-contract-page',
  'event-application-contract-page',
  'event-workflow-page',
  'event-workflow-verification-page',
  'pending-events-page',
  'events-tab',
  'event-card-button',
  'event-date-box',
  'pending-event-card',
  'assistant-summary-card',
  'step-card',
  'mode-card',
  'review-card',
  'action-card',
  'contract-card',
  'verification-card',
  'mini-badge',
]

test('legacy theme cleanup no longer owns event workflow presentation', () => {
  for (const selector of retiredEventSelectors) {
    assert.doesNotMatch(
      legacyCleanup,
      new RegExp(`\\.${selector.replaceAll('-', '\\-')}\\b`),
      `${selector} must remain in the canonical event styles instead of the legacy !important guard.`,
    )
  }

  assert.doesNotMatch(legacyCleanup, /event/i)
  assert.doesNotMatch(legacyCleanup, /mini-badge/)
})

test('legacy cleanup remains scoped to structural screens not yet consolidated', () => {
  assert.match(legacyCleanup, /\.level-office-page/)
  assert.match(legacyCleanup, /\.level-office-row/)
  assert.match(legacyCleanup, /\.level-office-summary/)
  assert.match(legacyCleanup, /\.structure-selector/)
  assert.match(legacyCleanup, /\.structure-selector-path/)
})

test('canonical event styles remain loaded before the temporary compatibility layer', () => {
  const sharedIndex = adminLayout.indexOf("import '@/styles/admin-event-workflows.css'")
  const planIndex = adminLayout.indexOf("import '@/styles/admin-event-action-plan.css'")
  const verificationIndex = adminLayout.indexOf("import '@/styles/admin-event-verification.css'")
  const legacyIndex = adminLayout.indexOf("import '@/styles/admin-embedded-theme-cleanup.css'")

  assert.ok(sharedIndex >= 0)
  assert.ok(planIndex > sharedIndex)
  assert.ok(verificationIndex > planIndex)
  assert.ok(legacyIndex > verificationIndex)

  assert.match(sharedEventStyles, /\.event-assistant-page/)
  assert.match(sharedEventStyles, /\.pending-events-page/)
  assert.match(actionPlanStyles, /\.event-action-plan-page/)
  assert.match(actionPlanStyles, /\.event-application-contract-page/)
  assert.match(verificationStyles, /\.event-workflow-verification-page/)
})
