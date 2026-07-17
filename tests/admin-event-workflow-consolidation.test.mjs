import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const adminLayout = await readFile('src/app/(admin)/layout.tsx', 'utf8')
const sharedStyles = await readFile('src/styles/admin-event-workflows.css', 'utf8')
const eventDraft = await readFile('src/features/events/admin/EventDraftPage.tsx', 'utf8')
const eventRegistry = await readFile('src/features/events/admin/EventRegistryPage.tsx', 'utf8')
const eventReview = await readFile('src/features/events/admin/EventReviewPage.tsx', 'utf8')

test('admin layout loads the canonical event workflow stylesheet', () => {
  assert.match(adminLayout, /admin-event-workflows\.css/)
  assert.match(sharedStyles, /\.event-assistant-page/)
  assert.match(sharedStyles, /\.assistant-stepper/)
  assert.match(sharedStyles, /\.events-toolbar/)
  assert.match(sharedStyles, /\.events-tabs/)
  assert.match(sharedStyles, /\.event-card-button/)
  assert.match(sharedStyles, /\.event-date-box/)
  assert.match(sharedStyles, /\.event-review-page/)
  assert.match(sharedStyles, /\.review-layout/)
  assert.match(sharedStyles, /\.impact-issue\.error/)
  assert.match(sharedStyles, /var\(--surface\)/)
  assert.match(sharedStyles, /var\(--surface-subtle\)/)
  assert.match(sharedStyles, /var\(--warning-soft\)/)
  assert.match(sharedStyles, /var\(--danger-soft\)/)
  assert.match(sharedStyles, /var\(--focus-ring\)/)
  assert.doesNotMatch(sharedStyles, /background:\s*#(?:fff|ffffff|fbf8f1|fff7ed|fef2f2)/i)
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

test('event registry no longer injects page-scoped styles', () => {
  assert.doesNotMatch(eventRegistry, /const pageStyles/)
  assert.doesNotMatch(eventRegistry, /<style>\{pageStyles\}<\/style>/)
})

test('event registry owns filter selection and detail announcement semantics', () => {
  assert.match(eventRegistry, /aria-pressed=\{workMode === mode\.key\}/)
  assert.match(eventRegistry, /aria-controls="event-detail-panel"/)
  assert.match(eventRegistry, /aria-pressed=\{isSelected\}/)
  assert.match(eventRegistry, /id="event-detail-panel" aria-live="polite" aria-atomic="true"/)
  assert.match(eventRegistry, /role="alert" aria-live="assertive"/)
  assert.match(eventRegistry, /role="status" aria-live="polite"/)
  assert.match(eventRegistry, /type="search"/)
})

test('event review no longer injects page-scoped styles', () => {
  assert.doesNotMatch(eventReview, /const pageStyles/)
  assert.doesNotMatch(eventReview, /<style>\{pageStyles\}<\/style>/)
})

test('event review owns validation impact and action semantics', () => {
  assert.match(eventReview, /aria-label=\{`\$\{title\}: \$\{ok \? 'correcto' : 'requiere atención'\}`\}/)
  assert.match(eventReview, /role=\{issue\.severity === 'error' \? 'alert' : 'status'\}/)
  assert.match(eventReview, /aria-atomic="true" aria-live="polite"/)
  assert.match(eventReview, /role="alert" aria-live="assertive"/)
  assert.match(eventReview, /aria-busy=\{saving\}/)
  assert.match(eventReview, /htmlFor="review-note"/)
  assert.match(eventReview, /id="review-note"/)
  assert.match(eventReview, /aria-describedby="review-action-guidance"/)
})
