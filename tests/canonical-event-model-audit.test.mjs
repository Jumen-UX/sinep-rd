import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('canonical event audit declares one historical source and derived application contracts', async () => {
  const audit = await readRepoFile('docs/sprints/active/sprint-5-event-model-audit.md')

  assert.match(audit, /`canonical_events` es el registro canónico del hecho/)
  assert.match(audit, /`canonical_event_types` es el catálogo canónico/)
  assert.match(audit, /Participantes, planes, acciones y contratos de aplicación son derivados/)
  assert.match(audit, /Las correcciones se representan mediante eventos compensatorios/)
  assert.match(audit, /Solo un evento aprobado, verificable y con contrato aplicable puede cambiar el estado vigente/)
})

test('event administration keeps one canonical route and explicit compatibility routes', async () => {
  const [canonicalRoute, legacyRoute, legacyVerification] = await Promise.all([
    readRepoFile('src/app/(admin)/admin/eventos/page.tsx'),
    readRepoFile('src/app/(admin)/admin/estructura/eventos/page.tsx'),
    readRepoFile('src/app/(admin)/admin/estructura/eventos/verificacion/page.tsx'),
  ])

  assert.match(canonicalRoute, /EventRegistryPage/)
  assert.match(legacyRoute, /EventRegistryPage/)
  assert.match(legacyVerification, /redirect\('\/admin\/eventos\/verificacion'\)/)
})

test('event workflow preserves draft review plan and application separation', async () => {
  const [draftService, workflowService, applicationService] = await Promise.all([
    readRepoFile('src/features/events/services/event-draft-admin-service.ts'),
    readRepoFile('src/features/events/services/event-workflow-admin-service.ts'),
    readRepoFile('src/features/events/services/event-application-admin-service.ts'),
  ])

  assert.match(draftService, /admin_create_event_draft/)
  assert.match(workflowService, /get_event_review/)
  assert.match(workflowService, /admin_review_event/)
  assert.match(applicationService, /get_event_application_plan/)
  assert.match(applicationService, /get_event_application_contract/)
  assert.match(applicationService, /admin_apply_organization_unit_event/)
})
