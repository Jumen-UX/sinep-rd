import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const adminLayout = await readFile('src/app/(admin)/layout.tsx', 'utf8')
const sharedStyles = await readFile('src/styles/admin-event-workflows.css', 'utf8')
const eventDraft = await readFile('src/features/events/admin/EventDraftPage.tsx', 'utf8')

test('admin layout loads the canonical event workflow stylesheet', () => {
  assert.match(adminLayout, /admin-event-workflows\.css/)
  assert.match(sharedStyles, /\.event-assistant-page/)
  assert.match(sharedStyles, /\.assistant-stepper/)
  assert.match(sharedStyles, /\.events-tabs/)
  assert.match(sharedStyles, /var\(--surface\)/)
  assert.match(sharedStyles, /var\(--focus-ring\)/)
})

test('event draft no longer injects page-scoped styles', () => {
  assert.doesNotMatch(eventDraft, /const pageStyles/)
  assert.doesNotMatch(eventDraft, /<style>\{pageStyles\}<\/style>/)
})

test('event draft owns its accessibility semantics instead of relying on the compatibility bridge', () => {
  assert.match(eventDraft, /<nav className="assistant-stepper" aria-label="Pasos del asistente">/)
  assert.match(eventDraft, /aria-current=\{step === item\.key \? 'step' : undefined\}/)
  assert.match(eventDraft, /aria-label=\{`Ir al paso \$\{index \+ 1\}: \$\{item\.title\}`\}/)
  assert.match(eventDraft, /aria-pressed=\{loadMode === mode\.key\}/)
  assert.match(eventDraft, /role="alert" aria-live="assertive"/)
  assert.match(eventDraft, /aria-busy=\{saving\}/)
})
