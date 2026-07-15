import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('event approval uses an explicit contract and never applies current state', async () => {
  const migration = await readRepoFile('supabase/migrations/20260715234500_separate_event_approval_from_application.sql')

  assert.match(migration, /create or replace function internal\.get_event_approval_readiness\(p_event_id uuid\)/)
  assert.match(migration, /approval_does_not_apply_state', true/)
  assert.match(migration, /create or replace function internal\.admin_approve_event\(payload jsonb\)/)
  assert.match(migration, /'application_required', true/)
  assert.match(migration, /'state_applied', false/)
  assert.match(migration, /create or replace function public\.admin_approve_event\(payload jsonb\)/)
  assert.doesNotMatch(
    migration.match(/create or replace function internal\.admin_approve_event[\s\S]*?\$function\$;/)?.[0] ?? '',
    /admin_save_organization_unit|canonical_relationships|structure_nodes|ecclesiastical_entities\s+set/,
  )
})

test('generic review cannot approve and application remains a separate guarded RPC', async () => {
  const migration = await readRepoFile('supabase/migrations/20260715234500_separate_event_approval_from_application.sql')
  const service = await readRepoFile('src/features/events/services/event-workflow-admin-service.ts')
  const existingApplication = await readRepoFile('src/features/events/services/event-application-admin-service.ts')

  assert.match(migration, /elsif v_action='approve' then\s+raise exception 'use_admin_approve_event'/)
  assert.match(service, /supabase\.rpc\('admin_approve_event'/)
  assert.match(service, /if \(action === 'approve'\)/)
  assert.match(existingApplication, /supabase\.rpc\('admin_apply_organization_unit_event'/)
  assert.doesNotMatch(service, /admin_apply_organization_unit_event/)
})

test('approval and application permissions remain distinct and private implementations are sealed', async () => {
  const migration = await readRepoFile('supabase/migrations/20260715234500_separate_event_approval_from_application.sql')

  assert.match(migration, /current_user_has_permission\('events\.approve'\)/)
  assert.match(migration, /revoke all on function internal\.admin_approve_event\(jsonb\) from public, anon, authenticated/)
  assert.match(migration, /revoke all on function app_private\.rpc_definer__admin_approve_event\(jsonb\) from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.admin_approve_event\(jsonb\) to authenticated/)
})
