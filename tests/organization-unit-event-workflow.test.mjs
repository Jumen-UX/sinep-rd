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
  reviewContract: 'supabase/migrations/20260714030000_extend_event_review_and_contract.sql',
  registry: 'supabase/migrations/20260714031000_include_organization_units_in_event_registry.sql',
  adminHardening: 'supabase/migrations/20260714032000_harden_canonical_event_admin_functions.sql',
  service: 'src/features/eventos/services/organization-unit-event-service.ts',
  page: 'src/features/eventos/admin/OrganizationUnitEventManagerPage.tsx',
  route: 'src/app/(admin)/admin/eventos/organizacion/page.tsx',
  reviewPage: 'src/app/(admin)/admin/eventos/[eventId]/page.tsx',
  planPage: 'src/app/(admin)/admin/eventos/[eventId]/plan/page.tsx',
  contractPage: 'src/app/(admin)/admin/eventos/[eventId]/contrato/page.tsx',
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

test('internal organization event helpers are never executable by clients', async () => {
  const [helperSql, adminSql] = await Promise.all([
    read(paths.hardening),
    read(paths.adminHardening),
  ])
  assert.match(helperSql, /revoke all on function internal\.admin_generate_organization_unit_event_action_plan\(jsonb\)/i)
  assert.match(helperSql, /from public,anon,authenticated/i)
  assert.match(adminSql, /revoke all on function internal\.admin_generate_event_action_plan\(jsonb\)/i)
  assert.match(adminSql, /get_event_application_plan\(uuid\)[\s\S]*from public,anon/i)
  assert.match(adminSql, /get_event_review\(uuid\)[\s\S]*from public,anon/i)
})

test('application plans expose unit targets and keep entity mutations locked', async () => {
  const sql = await read(paths.plan)
  assert.match(sql, /subject_organization_unit_name/i)
  assert.match(sql, /target_organization_unit_name/i)
  assert.match(sql, /can_apply_now/i)
  assert.match(sql, /cet\.applies_to='organization_unit'/i)
  assert.match(sql, /entity_application_not_enabled/i)
})

test('review and contract expose organization units without relationship conflicts', async () => {
  const sql = await read(paths.reviewContract)
  assert.match(sql, /organization_unit_name/i)
  assert.match(sql, /organization_chart_name/i)
  assert.match(sql, /scope_entity_name/i)
  assert.match(sql, /has_action_plan/i)
  assert.match(sql, /has_blocking_action/i)
  assert.match(sql, /not_applicable/i)
  assert.match(sql, /can_apply/i)
  assert.match(sql, /entity_application_not_enabled/i)
})

test('public event registry keeps old columns and appends explicit organization target fields', async () => {
  const sql = await read(paths.registry)
  assert.match(sql, /related_target_kind text/i)
  assert.match(sql, /related_organization_unit_id uuid/i)
  assert.match(sql, /related_organization_unit_name text/i)
  assert.match(sql, /participant\.organization_scope_entity_id/i)
  assert.match(sql, /ce\.notes_json->'raw_payload'->>'name'/i)
  assert.match(sql, /grant execute[\s\S]*to anon,authenticated,service_role/i)
})

test('admin UI exposes the complete organization event workflow', async () => {
  const [service, page, route, reviewPage, planPage, contractPage] = await Promise.all([
    read(paths.service),
    read(paths.page),
    read(paths.route),
    read(paths.reviewPage),
    read(paths.planPage),
    read(paths.contractPage),
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
  assert.match(reviewPage, /organization_unit_name/)
  assert.match(reviewPage, /has_action_plan/)
  assert.match(planPage, /subject_organization_unit_name/)
  assert.match(planPage, /aplicación automática jurisdiccional todavía no está habilitada/i)
  assert.match(contractPage, /summary\.can_apply/)
  assert.match(contractPage, /admin_apply_organization_unit_event/)
})
