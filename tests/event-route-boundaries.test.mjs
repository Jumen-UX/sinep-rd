import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('event draft route delegates to the events feature', async () => {
  const route = await readFile('src/app/(admin)/admin/eventos/nuevo/page.tsx', 'utf8')

  assert.match(route, /from '@\/features\/events'/)
  assert.doesNotMatch(route, /createClient/)
  assert.doesNotMatch(route, /\.from\s*\(/)
  assert.doesNotMatch(route, /\.rpc\s*\(/)
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
