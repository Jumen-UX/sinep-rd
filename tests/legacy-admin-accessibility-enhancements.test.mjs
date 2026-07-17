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

test('legacy admin dynamic messages are announced and mutations stay synchronized', () => {
  assert.match(enhancement, /\.error-box/)
  assert.match(enhancement, /role', 'alert'/)
  assert.match(enhancement, /aria-live', 'assertive'/)
  assert.match(enhancement, /\.empty-state/)
  assert.match(enhancement, /role', 'status'/)
  assert.match(enhancement, /aria-live', 'polite'/)
  assert.match(enhancement, /new MutationObserver/)
  assert.match(enhancement, /observer\.disconnect\(\)/)
})

test('admin layout mounts the shared legacy enhancement bridge', () => {
  assert.match(adminLayout, /LegacyAdminAccessibilityEnhancements/)
  assert.match(adminLayout, /<LegacyAdminAccessibilityEnhancements \/>/)
})
