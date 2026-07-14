import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const eventRoutes = [
  'src/app/(admin)/admin/eventos/page.tsx',
  'src/app/(admin)/admin/eventos/nuevo/page.tsx',
  'src/app/(admin)/admin/eventos/pendientes/page.tsx',
  'src/app/(admin)/admin/eventos/[eventId]/page.tsx',
]

test('event administration routes delegate to the events feature', async () => {
  for (const routeFile of eventRoutes) {
    const route = await readFile(routeFile, 'utf8')

    assert.match(route, /from '@\/features\/events'/)
    assert.doesNotMatch(route, /createClient/)
    assert.doesNotMatch(route, /\.from\s*\(/)
    assert.doesNotMatch(route, /\.rpc\s*\(/)
  }
})

test('event draft catalogs and mutation stay behind the event service', async () => {
  const featurePage = await readFile('src/features/events/admin/EventDraftPage.tsx', 'utf8')
  const service = await readFile('src/features/events/services/event-draft-admin-service.ts', 'utf8')

  assert.match(featurePage, /loadEventDraftOptions/)
  assert.match(featurePage, /createEventDraft/)
  assert.match(service, /canonical_event_types/)
  assert.match(service, /ecclesiastical_entities/)
  assert.match(service, /admin_create_event_draft/)
})

test('event registry reads stay behind the event registry service', async () => {
  const featurePage = await readFile('src/features/events/admin/EventRegistryPage.tsx', 'utf8')
  const service = await readFile('src/features/events/services/event-registry-admin-service.ts', 'utf8')

  assert.match(featurePage, /loadEventRegistry/)
  assert.match(service, /get_event_registry_summary/)
  assert.match(service, /get_event_registry_stream/)
})

test('event queue and review mutations stay behind the workflow service', async () => {
  const pendingPage = await readFile('src/features/events/admin/PendingEventsPage.tsx', 'utf8')
  const reviewPage = await readFile('src/features/events/admin/EventReviewPage.tsx', 'utf8')
  const service = await readFile('src/features/events/services/event-workflow-admin-service.ts', 'utf8')

  assert.match(pendingPage, /loadPendingEvents/)
  assert.match(reviewPage, /loadEventReview/)
  assert.match(reviewPage, /submitEventReview/)
  assert.match(service, /get_event_registry_stream/)
  assert.match(service, /get_event_review/)
  assert.match(service, /admin_review_event/)
})
