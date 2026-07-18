import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const enhancement = await readFile(
  'src/components/admin/LegacyAdminAccessibilityEnhancements.tsx',
  'utf8',
)
const adminLayout = await readFile('src/app/(admin)/layout.tsx', 'utf8')

const modernAdminRoots = [
  'event-assistant-page',
  'events-page',
  'event-review-page',
  'event-action-plan-page',
  'event-application-contract-page',
  'event-workflow-verification-page',
  'pending-events-page',
  'level-office-page',
  'structure-selector',
  'admin-priest-wizard',
  'admin-deacon-wizard',
  'admin-bishop-wizard',
  'admin-religious-wizard',
  'admin-lay-wizard',
]

test('legacy bridge excludes every modernized administrative flow', () => {
  assert.match(enhancement, /modernAdminRootSelector/)
  assert.match(enhancement, /belongsToModernizedAdminFlow/)
  assert.match(
    enhancement,
    /element\.closest\(modernAdminRootSelector\)/,
  )

  for (const root of modernAdminRoots) {
    assert.match(enhancement, new RegExp(`\\.${root}`))
  }

  assert.doesNotMatch(enhancement, /canonicalEventRootSelector/)
  assert.doesNotMatch(enhancement, /belongsToCanonicalEventFlow/)
  assert.doesNotMatch(enhancement, /\.assistant-stepper/)
  assert.doesNotMatch(enhancement, /\.step-card/)
  assert.doesNotMatch(enhancement, /\.mode-card/)
})

test('modernized forms are excluded from legacy error association', () => {
  assert.match(
    enhancement,
    /if \(belongsToModernizedAdminFlow\(form\)\) return/,
  )
  assert.match(enhancement, /associateLegacyFormErrors/)
  assert.match(enhancement, /field\.checkValidity\(\)/)
  assert.match(enhancement, /aria-invalid', 'true'/)
  assert.match(enhancement, /dataset\.a11yErrorId/)
  assert.match(enhancement, /appendDescriptionId/)
  assert.match(enhancement, /aria-describedby/)
  assert.match(
    enhancement,
    /queueMicrotask\(\(\) => invalidField\.focus\(\)\)/,
  )
})

test('legacy feedback preserves native semantics and skips modern roots', () => {
  assert.match(enhancement, /\.error-box, \.admin-navigation-error/)
  assert.match(
    enhancement,
    /\.empty-state, \.success-box, \.admin-warning-box, \.admin-info-box, \.admin-navigation-status/,
  )
  assert.equal(
    (
      enhancement.match(
        /if \(belongsToModernizedAdminFlow\((?:message|region)\)\) return/g,
      ) ?? []
    ).length,
    3,
  )
  assert.match(enhancement, /if \(!message\.hasAttribute\('role'\)\)/)
  assert.match(enhancement, /if \(!message\.hasAttribute\('aria-live'\)\)/)
  assert.match(enhancement, /if \(!message\.hasAttribute\('aria-atomic'\)\)/)
  assert.match(enhancement, /\[data-loading="true"\], \[aria-busy="true"\]/)
})

test('corrected legacy fields clear only their linked error state', () => {
  assert.match(enhancement, /handleFieldCorrection/)
  assert.match(enhancement, /removeDescriptionId/)
  assert.match(enhancement, /removeAttribute\('aria-invalid'\)/)
  assert.match(enhancement, /root\.addEventListener\('input', handleFieldCorrection\)/)
  assert.match(enhancement, /root\.addEventListener\('change', handleFieldCorrection\)/)
  assert.match(enhancement, /root\.removeEventListener\('input', handleFieldCorrection\)/)
  assert.match(enhancement, /root\.removeEventListener\('change', handleFieldCorrection\)/)
})

test('mobile admin dialog traps focus closes with Escape and restores its trigger', () => {
  assert.match(enhancement, /#admin-mobile-menu/)
  assert.match(enhancement, /aria-modal', 'true'/)
  assert.match(enhancement, /dialog\.setAttribute\('tabindex', '-1'\)/)
  assert.match(enhancement, /event\.key === 'Escape'/)
  assert.match(enhancement, /event\.key !== 'Tab'/)
  assert.match(enhancement, /last\.focus\(\)/)
  assert.match(enhancement, /first\.focus\(\)/)
  assert.match(enhancement, /returnFocus\?\.focus\(\)/)
  assert.match(enhancement, /new MutationObserver\(synchronize\)/)
  assert.match(enhancement, /observer\.disconnect\(\)/)
})

test('admin layout keeps the temporary narrowed bridge mounted', () => {
  assert.match(adminLayout, /LegacyAdminAccessibilityEnhancements/)
  assert.match(adminLayout, /<LegacyAdminAccessibilityEnhancements \/>/)
})
