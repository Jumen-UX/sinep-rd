import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const paths = {
  schema: 'supabase/migrations/20260714026000_extend_canonical_events_to_organization_units.sql',
  workflow: 'supabase/migrations/20260714027000_support_organization_unit_event_drafts_and_plans.sql',
  apply: 'supabase/migrations/20260714028000_approve_and_apply_organization_unit_events.sql',
  plan: 'supabase/migrations/20260714029000_expose_organization_unit_event_plans.sql',
  hardening: 'supabase/migrations/20260714029500_harden_organization_unit_event_helpers.sql',
  service: 'src/features/eventos/services/organization-unit-event-service.ts',
  page: 'src/features/eventos/admin/OrganizationUnitEventManagerPage.tsx',
  route: 'src/app/(admin)/admin/eventos/organizacion/page.tsx',
}

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('canonical events reference organization units explicitly', async () => {
  const sql = await read(paths.schema)
  assert.match(sql, /canonical_event_participants[\s\S]*organization_unit_id/i)
  assert.match(sql, /subject_organization_unit_id/i)
  assert.match(sql, /target_organization_unit_id/i)
  assert.match(sql, /num_nonnulls\(entity_id,organization_unit_id\)=1/i)
  assert.match(sql, /organization_unit_creation/i)
  assert.match(sql, /organization_unit_reparenting/i)
  assert.match(sql, /organization_unit_status_change/i)
  assert.match(sql, /organization_unit_publication/i)
  assert.match(sql, /organization_unit_validity_change/i)
})

test('draft and plan generation dispatch by canonical target kind', async () => {
  const sql = await read(paths.workflow)
  assert.match(sql, /target_kind[\s\S]*organization_unit/i)
  assert.match(sql, /canonical_event_scope_entity_id/i)
  assert.match(sql, /admin_generate_organization_unit_event_action_plan/i)
  assert.match(sql, /admin_generate_entity_event_action_plan/i)
  assert.match(sql, /create_organization_unit/i)
  assert.match(sql, /move_organization_unit/i)
  assert.match(sql, /publish_organization_unit/i)
  assert.match(sql, /update_organization_unit_validity/i)
})

test('only approved scoped organization events can mutate current state', async () => {
  const sql = await read(paths.apply)
  assert.match(sql, /events\.apply/i)
  assert.match(sql, /event_action_plan_required/i)
  assert.match(sql, /event_source_or_manual_review_pending/i)
  assert.match(sql, /event_not_approved/i)
  assert.match(sql, /event_is_not_organizational/i)
  assert.match(sql, /internal\.admin_save_organization_unit/i)
  assert.match(sql, /set status='applied'/i)
  assert.match(sql, /revoke all on function public\.admin_apply_organization_unit_event\(jsonb\) from public,anon/i)
  assert.match(sql, /grant execute on function public\.admin_apply_organization_unit_event\(jsonb\) to authenticated,service_role/i)
})

test('internal organization plan helper is never executable by clients', async () => {
  const sql = await read(paths.hardening)
  assert.match(sql, /revoke all on function internal\.admin_generate_organization_unit_event_action_plan\(jsonb\)/i)
  assert.match(sql, /from public,anon,authenticated/i)
})

test('application plans expose unit targets and keep entity mutations locked', async () => {
  const sql = await read(paths.plan)
  assert.match(sql, /subject_organization_unit_name/i)
  assert.match(sql, /target_organization_unit_name/i)
  assert.match(sql, /can_apply_now/i)
  assert.match(sql, /cet\.applies_to='organization_unit'/i)
  assert.match(sql, /entity_application_not_enabled/i)
})

test('admin UI exposes the complete organization event workflow', async () => {
  const [service, page, route] = await Promise.all([
    read(paths.service),
    read(paths.page),
    read(paths.route),
  ])
  for (const rpc of [
    'admin_create_event_draft',
    'admin_generate_event_action_plan',
    'admin_review_event',
    'admin_apply_organization_unit_event',
    'get_event_application_plan',
  ]) assert.match(service, new RegExp(rpc))

  assert.match(page, /Crear borrador/)
  assert.match(page, /Generar plan/)
  assert.match(page, /Aprobar/)
  assert.match(page, /Aplicar evento/)
  assert.match(page, /can_apply_now/)
  assert.match(route, /OrganizationUnitEventManagerPage/)
})
