import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('event impact builder is deterministic read only and dependency aware', async () => {
  const source = await readRepoFile('src/features/events/services/event-impact-plan.ts')

  assert.match(source, /generatedFrom: 'canonical_event_actions'/)
  assert.match(source, /readOnly: true/)
  assert.match(source, /sort_order - right\.sort_order/)
  assert.match(source, /depends_on_action_ids/)
  assert.match(source, /missing_action_dependency/)
  assert.match(source, /cyclic_action_dependencies/)
  assert.match(source, /canApprove:/)
  assert.doesNotMatch(source, /supabase\.(rpc|from)\(/)
  assert.doesNotMatch(source, /\.from\([^\n]+\)\.(insert|update|delete|upsert)\(/)
})

test('impact projection exposes verification and remains a stable read contract', async () => {
  const migration = await readRepoFile('supabase/migrations/20260715231500_expose_deterministic_event_impact_plan.sql')
  const service = await readRepoFile('src/features/events/services/event-application-admin-service.ts')

  assert.match(migration, /create or replace function public\.get_event_application_plan\(p_event_id uuid\)/)
  assert.match(migration, /language sql\s+stable/)
  assert.match(migration, /'verification_status',ce\.verification_status/)
  assert.match(migration, /order by cea\.sort_order,cea\.id/)
  assert.match(migration, /revoke all on function public\.get_event_application_plan\(uuid\) from public, anon/)
  assert.match(service, /verification_status: string/)
})

test('event review renders deterministic impact and blocks blind approval', async () => {
  const page = await readRepoFile('src/features/events/admin/EventReviewPage.tsx')
  const impactService = await readRepoFile('src/features/events/services/event-impact-admin-service.ts')

  assert.match(page, /loadDeterministicEventImpactPlan/)
  assert.match(page, /ImpactPreview impact=\{impact\}/)
  assert.match(page, /impact\?\.canApprove === true/)
  assert.match(page, /El evento no puede aprobarse hasta que el plan de impacto esté completo y sin bloqueos/)
  assert.match(page, /Dependencias:/)
  assert.match(page, /derivedUpdates\.map/)
  assert.match(impactService, /buildDeterministicImpactPlan/)
})
