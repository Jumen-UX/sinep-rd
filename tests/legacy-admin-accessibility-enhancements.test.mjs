import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const enhancement = await readFile('src/components/admin/LegacyAdminAccessibilityEnhancements.tsx', 'utf8')
const adminLayout = await readFile('src/app/(admin)/layout.tsx', 'utf8')

test('legacy admin assistants expose current step and selected mode semantics', () => {
  assert.match(enhancement, /\.assistant-stepper/)
  assert.match(enhancement, /role', 'navigation'/)
  assert.match(enhancement, /aria-label', 'Pasos del asistente'/)
  assert.match(enhancement, /aria-current', 'step'/)
  assert.match(enhancement, /Ir al paso \$\{index \+ 1\}/)
  assert.match(enhancement, /\.mode-card/)
  assert.match(enhancement, /aria-pressed/)
})

test('legacy admin feedback announces errors and non-blocking status changes', () => {
  assert.match(enhancement, /configureLiveRegion/)
  assert.match(enhancement, /\.error-box, \.admin-navigation-error/)
  assert.match(enhancement, /'assertive', 'alert'/)
  assert.match(enhancement, /\.empty-state, \.success-box, \.admin-warning-box, \.admin-info-box, \.admin-navigation-status/)
  assert.match(enhancement, /'polite', 'status'/)
  assert.match(enhancement, /aria-atomic/)
  assert.match(enhancement, /\[data-loading="true"\], \[aria-busy="true"\]/)
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
