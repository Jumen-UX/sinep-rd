import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const enhancement = await readFile('src/components/admin/LegacyAdminAccessibilityEnhancements.tsx', 'utf8')
const adminLayout = await readFile('src/app/(admin)/layout.tsx', 'utf8')

const canonicalEventRoots = [
  'event-assistant-page',
  'events-page',
  'event-review-page',
  'event-action-plan-page',
  'event-application-contract-page',
  'event-workflow-verification-page',
  'pending-events-page',
]

test('legacy bridge no longer owns canonical event assistant semantics', () => {
  assert.match(enhancement, /canonicalEventRootSelector/)
  for (const root of canonicalEventRoots) assert.match(enhancement, new RegExp(`\\.${root}`))

  assert.doesNotMatch(enhancement, /\.assistant-stepper/)
  assert.doesNotMatch(enhancement, /\.step-card/)
  assert.doesNotMatch(enhancement, /\.mode-card/)
  assert.doesNotMatch(enhancement, /aria-current', 'step'/)
  assert.doesNotMatch(enhancement, /Ir al paso \$\{index \+ 1\}/)
})

test('legacy feedback skips canonical event flows and preserves native semantics', () => {
  assert.match(enhancement, /belongsToCanonicalEventFlow/)
  assert.match(enhancement, /element\.closest\(canonicalEventRootSelector\)/)
  assert.match(enhancement, /\.error-box, \.admin-navigation-error/)
  assert.match(enhancement, /\.empty-state, \.success-box, \.admin-warning-box, \.admin-info-box, \.admin-navigation-status/)
  assert.equal((enhancement.match(/if \(belongsToCanonicalEventFlow\((?:message|region)\)\) return/g) ?? []).length, 3)
  assert.match(enhancement, /if \(!message\.hasAttribute\('role'\)\)/)
  assert.match(enhancement, /if \(!message\.hasAttribute\('aria-live'\)\)/)
  assert.match(enhancement, /if \(!message\.hasAttribute\('aria-atomic'\)\)/)
  assert.match(enhancement, /\[data-loading="true"\], \[aria-busy="true"\]/)
  assert.match(enhancement, /region\.getAttribute\('aria-busy'\) !== 'true'/)
})

test('legacy form errors are associated with the first invalid control and preserve existing help', () => {
  assert.match(enhancement, /associateLegacyFormErrors/)
  assert.match(enhancement, /field\.checkValidity\(\)/)
  assert.match(enhancement, /aria-invalid', 'true'/)
  assert.match(enhancement, /dataset\.a11yErrorId/)
  assert.match(enhancement, /appendDescriptionId/)
  assert.match(enhancement, /aria-describedby/)
  assert.match(enhancement, /queueMicrotask\(\(\) => invalidField\.focus\(\)\)/)
})

test('corrected legacy fields clear only the linked error state', () => {
  assert.match(enhancement, /handleFieldCorrection/)
  assert.match(enhancement, /removeDescriptionId/)
  assert.match(enhancement, /removeAttribute\('aria-invalid'\)/)
  assert.match(enhancement, /root\.addEventListener\('input', handleFieldCorrection\)/)
  assert.match(enhancement, /root\.addEventListener\('change', handleFieldCorrection\)/)
  assert.match(enhancement, /root\.removeEventListener\('input', handleFieldCorrection\)/)
  assert.match(enhancement, /root\.removeEventListener\('change', handleFieldCorrection\)/)
})

test('legacy mutations remain synchronized with feedback and dialog state', () => {
  assert.match(enhancement, /new MutationObserver/)
  assert.match(enhancement, /attributeFilter: \['class', 'hidden', 'aria-expanded', 'aria-busy', 'data-loading'\]/)
})

test('mobile admin dialog traps focus closes with Escape and restores its trigger', () => {
  assert.match(enhancement, /#admin-mobile-menu/)
  assert.match(enhancement, /aria-modal', 'true'/)
  assert.match(enhancement, /dialog\.setAttribute\('tabindex', '-1'\)/)
  assert.match(enhancement, /queueMicrotask/)
  assert.match(enhancement, /event\.key === 'Escape'/)
  assert.match(enhancement, /event\.key !== 'Tab'/)
  assert.match(enhancement, /last\.focus\(\)/)
  assert.match(enhancement, /first\.focus\(\)/)
  assert.match(enhancement, /returnFocus\?\.focus\(\)/)
  assert.match(enhancement, /removeEventListener\('keydown', handleKeyDown\)/)
  assert.match(enhancement, /observer\.disconnect\(\)/)
})

test('admin layout mounts the shared legacy enhancement bridge', () => {
  assert.match(adminLayout, /LegacyAdminAccessibilityEnhancements/)
  assert.match(adminLayout, /<LegacyAdminAccessibilityEnhancements \/>/)
})
