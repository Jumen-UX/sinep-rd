import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPaths = [
  new URL('../supabase/migrations/20260713152219_audit_scope_columns_and_resolver.sql', import.meta.url),
  new URL('../supabase/migrations/20260713152254_enforce_scoped_audit_contracts.sql', import.meta.url),
  new URL('../supabase/migrations/20260713152305_revoke_direct_canonical_table_writes.sql', import.meta.url),
  new URL('../supabase/migrations/20260713152413_normalize_unknown_audit_scope.sql', import.meta.url),
  new URL('../supabase/migrations/20260713153323_finalize_audit_scope_defaults.sql', import.meta.url),
  new URL('../supabase/migrations/20260713154230_consolidate_audit_permission_mapping.sql', import.meta.url),
  new URL('../supabase/migrations/20260713154343_consolidate_canonical_person_auditing.sql', import.meta.url),
  new URL('../supabase/migrations/20260713154401_consolidate_death_flow_auditing.sql', import.meta.url),
  new URL('../supabase/migrations/20260713154503_consolidate_entity_mutation_auditing.sql', import.meta.url),
  new URL('../supabase/migrations/20260713154522_consolidate_assignment_mutation_auditing.sql', import.meta.url),
  new URL('../supabase/migrations/20260713154637_consolidate_structure_mutation_auditing.sql', import.meta.url),
  new URL('../supabase/migrations/20260713154857_audit_and_seal_canonical_event_mutations.sql', import.meta.url),
  new URL('../supabase/migrations/20260713155005_audit_and_seal_structural_event_mutations.sql', import.meta.url),
  new URL('../supabase/migrations/20260713155958_route_legacy_person_wizards_through_canonical_contract.sql', import.meta.url),
  new URL('../supabase/migrations/20260713160159_enrich_legacy_audit_scope_automatically.sql', import.meta.url),
  new URL('../supabase/migrations/20260713160317_seal_legacy_jurisdiction_and_office_mutations.sql', import.meta.url),
  new URL('../supabase/migrations/20260713160539_seal_user_private_rpcs.sql', import.meta.url),
  new URL('../supabase/migrations/20260713160552_seal_import_mutation_private_rpcs.sql', import.meta.url),
  new URL('../supabase/migrations/20260713160611_seal_review_queue_private_rpc.sql', import.meta.url),
]

async function readSecurityMigrations() {
  const contents = await Promise.all(migrationPaths.map((path) => readFile(path, 'utf8')))
  return contents.join('\n')
}

test('audit records persist jurisdiction and pastoral scope', async () => {
  const sql = await readSecurityMigrations()

  assert.match(sql, /add column if not exists scope_type text/)
  assert.match(sql, /add column if not exists scope_entity_id uuid/)
  assert.match(sql, /add column if not exists diocese_id uuid/)
  assert.match(sql, /resolve_audit_scope/)
  assert.match(sql, /alter column scope_type set default 'unknown'/)
  assert.match(sql, /alter column scope_type set not null/)
})

test('audit writer requires permission and validates entity scope', async () => {
  const sql = await readSecurityMigrations()

  assert.match(sql, /audit_permission_for_action/)
  assert.match(sql, /current_user_has_permission\(v_permission_key\)/)
  assert.match(sql, /current_user_can_manage_entity\(v_permission_key, v_scope\.resolved_scope_entity_id\)/)
  assert.match(sql, /La operación de auditoría está fuera de tu alcance/)
  assert.match(sql, /revoke all on function public\.admin_write_audit_log[^;]+from public, anon/s)
})

test('audit reader filters records by the current user jurisdiction', async () => {
  const sql = await readSecurityMigrations()

  assert.match(sql, /current_user_can_manage_entity\('audit\.view', al\.scope_entity_id\)/)
  assert.match(sql, /current_user_has_scope_access\(\s*'organization_unit'/)
  assert.match(sql, /current_user_has_scope_access\(\s*'pastoral_area'/)
})

test('legacy audit writes receive permission and scope automatically', async () => {
  const sql = await readSecurityMigrations()

  assert.match(sql, /enrich_audit_log_before_write/)
  assert.match(sql, /trg_audit_logs_enrich_scope/)
  assert.match(sql, /new\.permission_key := coalesce/)
  assert.match(sql, /app_private\.resolve_audit_scope/)
})

test('critical canonical tables cannot be written directly by authenticated clients', async () => {
  const sql = await readSecurityMigrations()

  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger/)
  for (const table of [
    'public.canonical_events',
    'public.clergy_profiles',
    'public.ecclesiastical_entities',
    'public.position_assignments',
  ]) {
    assert.match(sql, new RegExp(table.replace('.', '\\.'), 'i'))
  }

  assert.match(sql, /drop policy if exists canonical_events_admin_insert/)
  assert.match(sql, /drop policy if exists phase0_clergy_profiles_insert/)
  assert.match(sql, /drop policy if exists phase0_ecclesiastical_entities_insert/)
  assert.match(sql, /drop policy if exists phase0_position_assignments_insert/)
})

test('core person entity assignment and structure mutations write scoped audits', async () => {
  const sql = await readSecurityMigrations()

  for (const action of [
    'people.person.created',
    'people.person.deceased',
    'entities.entity.created',
    'appointments.assignment.created',
    'structures.template.saved',
    'structures.level.saved',
    'structures.node.saved',
  ]) {
    assert.match(sql, new RegExp(action.replaceAll('.', '\\.'), 'i'))
  }

  for (const internalFunction of [
    'internal.admin_save_canonical_person',
    'internal.admin_mark_person_deceased',
    'internal.admin_save_ecclesiastical_entity',
    'internal.admin_save_position_assignment',
    'internal.admin_save_structure_template',
    'internal.admin_save_structure_level',
    'internal.admin_save_structure_node',
  ]) {
    assert.match(sql, new RegExp(`revoke all on function ${internalFunction.replaceAll('.', '\\.')}`))
  }
})

test('canonical and structural event mutations require scope and audit every write path', async () => {
  const sql = await readSecurityMigrations()

  assert.match(sql, /canonical_event_scope_entity_id/)
  assert.match(sql, /structure_event_diocese_id/)
  assert.match(sql, /current_user_can_manage_entity\('events\.create_proposal'/)
  assert.match(sql, /current_user_can_manage_entity\('events\.approve'/)
  assert.match(sql, /current_user_can_manage_entity\('events\.update_proposal'/)
  assert.match(sql, /current_user_can_manage_entity\('structures\.manage'/)

  for (const action of [
    'events.draft.created',
    'events.reviewed',
    'events.plan.generated',
    'events.action.updated',
    'events.action.configured',
    'structures.event.draft.created',
    'structures.event.reviewed',
    'structures.event.plan.generated',
    'structures.event.action.updated',
    'structures.event.action.configured',
  ]) {
    assert.match(sql, new RegExp(action.replaceAll('.', '\\.'), 'i'))
  }

  for (const internalFunction of [
    'internal.admin_create_event_draft',
    'internal.admin_review_event',
    'internal.admin_generate_event_action_plan',
    'internal.admin_update_event_action',
    'internal.admin_configure_event_action',
    'internal.admin_create_structural_evolution_event_draft',
    'internal.admin_review_structural_evolution_event',
    'internal.admin_generate_structural_application_plan',
    'internal.admin_update_structural_event_action',
    'internal.admin_configure_structural_event_action',
  ]) {
    assert.match(sql, new RegExp(`revoke all on function ${internalFunction.replaceAll('.', '\\.')}`))
  }
})

test('legacy person wizards route through the canonical public contract', async () => {
  const sql = await readSecurityMigrations()

  for (const wizard of [
    'admin_save_bishop',
    'admin_save_deacon',
    'admin_save_priest',
    'admin_save_layperson',
    'admin_save_religious',
  ]) {
    assert.match(sql, new RegExp(`function public\\.${wizard}`))
  }

  assert.match(sql, /select public\.admin_save_canonical_person/)
  assert.match(sql, /revoke all on function internal\.admin_save_bishop_with_dimensions/)
  assert.match(sql, /revoke all on function internal\.admin_save_priest/)
})

test('jurisdiction office and assignment review mutations are sealed behind scoped public contracts', async () => {
  const sql = await readSecurityMigrations()

  assert.match(sql, /function public\.admin_save_jurisdiction/)
  assert.match(sql, /entities\.jurisdiction\.created/)
  assert.match(sql, /Solo la administración nacional puede crear cargos canónicos globales/)
  assert.match(sql, /El alcance de la sugerencia está fuera de tu jurisdicción/)
  assert.match(sql, /current_user_can_manage_entity\('appointments\.approve'/)

  for (const internalFunction of [
    'internal.admin_save_jurisdiction',
    'internal.admin_save_office_configuration',
    'internal.admin_update_office_configuration',
    'internal.apply_office_canonical_rules',
    'internal.editor_suggest_office_configuration',
    'internal.resolve_assignment_canonical_incompatibility',
  ]) {
    assert.match(sql, new RegExp(`revoke all on function ${internalFunction.replaceAll('.', '\\.')}`))
  }
})

test('user import and review private RPCs are only reachable through public security definer facades', async () => {
  const sql = await readSecurityMigrations()

  for (const privateFunction of [
    'app_private.admin_assign_user_role',
    'app_private.admin_end_user_role',
    'app_private.admin_update_user_profile_status',
    'app_private.admin_prepare_import_batch',
    'app_private.admin_review_import_batch',
    'app_private.admin_update_import_batch_row',
    'app_private.validate_import_batch',
    'app_private.admin_review_queue',
  ]) {
    assert.match(sql, new RegExp(`revoke all on function ${privateFunction.replaceAll('.', '\\.')}`))
  }

  assert.match(sql, /function public\.admin_assign_user_role/)
  assert.match(sql, /function public\.admin_prepare_import_batch/)
  assert.match(sql, /alter function public\.admin_review_queue\(jsonb\) security definer/)
})
