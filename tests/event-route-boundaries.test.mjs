import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const eventRoutes = [
  'src/app/(admin)/admin/eventos/page.tsx',
  'src/app/(admin)/admin/eventos/nuevo/page.tsx',
  'src/app/(admin)/admin/eventos/pendientes/page.tsx',
  'src/app/(admin)/admin/eventos/verificacion/page.tsx',
  'src/app/(admin)/admin/eventos/[eventId]/page.tsx',
  'src/app/(admin)/admin/eventos/[eventId]/plan/page.tsx',
  'src/app/(admin)/admin/eventos/[eventId]/contrato/page.tsx',
  'src/app/(admin)/admin/estructura/eventos/page.tsx',
  'src/app/(admin)/admin/estructura/eventos/[eventId]/page.tsx',
  'src/app/(admin)/admin/estructura/eventos/[eventId]/plan/page.tsx',
  'src/app/(admin)/admin/estructura/eventos/[eventId]/contrato/page.tsx',
]

test('event administration routes delegate to the events feature', async () => {
  for (const routeFile of eventRoutes) {
    const route = await readFile(routeFile, 'utf8')

    assert.match(route, /from '@\/features\/events'/)
    assert.doesNotMatch(route, /createClient/)
    assert.doesNotMatch(route, /\.from\s*\(/)
    assert.doesNotMatch(route, /\.rpc\s*\(/)
    assert.doesNotMatch(route, /admin_create_structural_evolution_event_draft/)
  }
})

test('legacy structural event verification redirects to the canonical verification route', async () => {
  const route = await readFile('src/app/(admin)/admin/estructura/eventos/verificacion/page.tsx', 'utf8')

  assert.match(route, /redirect\('\/admin\/eventos\/verificacion'\)/)
  assert.doesNotMatch(route, /createClient/)
  assert.doesNotMatch(route, /get_structural_workflow_health/)
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

test('event queue review and verification stay behind the workflow service', async () => {
  const pendingPage = await readFile('src/features/events/admin/PendingEventsPage.tsx', 'utf8')
  const reviewPage = await readFile('src/features/events/admin/EventReviewPage.tsx', 'utf8')
  const verificationPage = await readFile('src/features/events/admin/EventWorkflowVerificationPage.tsx', 'utf8')
  const service = await readFile('src/features/events/services/event-workflow-admin-service.ts', 'utf8')

  assert.match(pendingPage, /loadPendingEvents/)
  assert.match(reviewPage, /loadEventReview/)
  assert.match(reviewPage, /submitEventReview/)
  assert.match(verificationPage, /loadEventWorkflowHealth/)
  assert.match(service, /get_event_registry_stream/)
  assert.match(service, /get_event_review/)
  assert.match(service, /admin_review_event/)
  assert.match(service, /get_event_workflow_health/)
})

test('event plans and contracts stay behind the application service', async () => {
  const planPage = await readFile('src/features/events/admin/EventActionPlanPage.tsx', 'utf8')
  const contractPage = await readFile('src/features/events/admin/EventApplicationContractPage.tsx', 'utf8')
  const service = await readFile('src/features/events/services/event-application-admin-service.ts', 'utf8')

  assert.match(planPage, /loadEventApplicationPlan/)
  assert.match(planPage, /generateEventActionPlan/)
  assert.match(planPage, /configureEventAction/)
  assert.match(contractPage, /loadEventApplicationContract/)
  assert.match(contractPage, /applyOrganizationUnitEvent/)
  assert.match(service, /get_event_application_plan/)
  assert.match(service, /get_event_relationship_conflict_preview/)
  assert.match(service, /admin_generate_event_action_plan/)
  assert.match(service, /admin_update_event_action/)
  assert.match(service, /admin_configure_event_action/)
  assert.match(service, /get_event_application_contract/)
  assert.match(service, /admin_apply_organization_unit_event/)
})
