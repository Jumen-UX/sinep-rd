import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrationPaths = {
  base: 'supabase/migrations/20260711025340_prepare_persistent_import_batches.sql',
  review: 'supabase/migrations/20260711030620_review_persistent_import_batches.sql',
  personApply: 'supabase/migrations/20260711032519_apply_person_import_batches.sql',
  structureValidate: 'supabase/migrations/20260711040000_validate_structure_import_batches.sql',
  structureApply: 'supabase/migrations/20260711040100_dispatch_structure_import_application.sql',
  assignmentValidate: 'supabase/migrations/20260711135209_validate_assignment_import_batches.sql',
  assignmentApply: 'supabase/migrations/20260711135337_apply_assignment_import_batches.sql',
  eventValidate: 'supabase/migrations/20260711203434_finalize_event_import_validation.sql',
  eventDispatch: 'supabase/migrations/20260711203456_dispatch_event_import_validation.sql',
  eventApply: 'supabase/migrations/20260711203628_apply_historical_event_import_batches.sql',
  eventReview: 'supabase/migrations/20260711203655_enable_event_import_review_capability.sql',
  noopPromote: 'supabase/migrations/20260711213847_promote_exact_import_matches_to_noop.sql',
  noopApply: 'supabase/migrations/20260711214021_apply_noop_only_import_batches.sql',
  noopUuidFix: 'supabase/migrations/20260711214142_fix_noop_uuid_aggregation.sql',
}

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('batch import persistence keeps batches, rows, issues and applied changes', async () => {
  const migration = await readRepoFile(migrationPaths.base)
  for (const table of ['import_batches', 'import_batch_rows', 'import_batch_row_issues', 'import_batch_changes']) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`))
  }
  assert.match(migration, /enable row level security/)
  assert.match(migration, /file_sha256 text not null/)
  assert.match(migration, /scope_entity_id uuid/)
})

test('person, structure and assignment domains use canonical engines', async () => {
  const [person, structureValidation, structureApplication, assignmentValidation, assignmentApplication] = await Promise.all([
    readRepoFile(migrationPaths.personApply),
    readRepoFile(migrationPaths.structureValidate),
    readRepoFile(migrationPaths.structureApply),
    readRepoFile(migrationPaths.assignmentValidate),
    readRepoFile(migrationPaths.assignmentApply),
  ])

  assert.match(person, /internal\.admin_save_canonical_person/)
  assert.match(person, /idempotent_replay/)
  assert.match(structureValidation, /exact_structure_duplicate/)
  assert.match(structureValidation, /invalid_structure_parent_level/)
  assert.match(structureApplication, /public\.admin_create_structure_node_entity/)
  assert.match(structureApplication, /import\.structure\.created/)
  assert.match(assignmentValidation, /evaluate_position_assignment_eligibility/)
  assert.match(assignmentValidation, /existing_assignment/)
  assert.match(assignmentApplication, /public\.admin_save_position_assignment/)
  assert.match(assignmentApplication, /close_previous_current/)
  assert.match(assignmentApplication, /import\.assignment\.created/)
})

test('historical event batches create reviewable event records without mutating structural state', async () => {
  const [validation, dispatch, application, review] = await Promise.all([
    readRepoFile(migrationPaths.eventValidate),
    readRepoFile(migrationPaths.eventDispatch),
    readRepoFile(migrationPaths.eventApply),
    readRepoFile(migrationPaths.eventReview),
  ])

  assert.match(validation, /finalize_event_import_validation/)
  assert.match(validation, /existing_historical_event/)
  assert.match(validation, /target_table='canonical_events'/)
  assert.match(dispatch, /v_import_type='eventos'/)
  assert.match(application, /public\.admin_create_event_draft/)
  assert.match(application, /public\.admin_generate_event_action_plan/)
  assert.match(application, /created_event_status','pending_review'/)
  assert.match(application, /structural_state_modified',false/)
  assert.match(application, /insert into public\.import_batch_changes/)
  assert.match(application, /idempotent_replay',true/)
  assert.match(application, /v_type='eventos'/)
  assert.match(review, /v_batch\.import_type in \('personas','parroquias','asignaciones','eventos'\)/)
})

test('exact deterministic matches become auditable noop operations', async () => {
  const [promotion, application, uuidFix] = await Promise.all([
    readRepoFile(migrationPaths.noopPromote),
    readRepoFile(migrationPaths.noopApply),
    readRepoFile(migrationPaths.noopUuidFix),
  ])

  assert.match(promotion, /promote_exact_import_matches_to_noop/)
  assert.match(promotion, /v_batch\.import_type not in \('parroquias','asignaciones','eventos'\)/)
  assert.match(promotion, /target_operation='noop'/)
  assert.match(promotion, /exact_contextual_match/)
  assert.match(promotion, /exact_assignment_match/)
  assert.match(promotion, /exact_event_match/)
  assert.match(promotion, /array_agg\(pa\.id order by pa\.id\)/)
  assert.doesNotMatch(promotion, /min\([^)]*\.id\)/)

  assert.match(application, /admin_apply_noop_import_batch/)
  assert.match(application, /operation,'noop'/)
  assert.match(application, /canonical_records_modified',false/)
  assert.match(application, /before_data,after_data/)
  assert.match(application, /idempotent_replay',true/)
  assert.match(application, /Los lotes mixtos con create y noop/)
  assert.match(uuidFix, /array_agg\(uuid\)\[1\]/)
})

test('privileged implementations remain outside the exposed public schema', async () => {
  const files = await Promise.all([
    readRepoFile(migrationPaths.personApply),
    readRepoFile(migrationPaths.structureApply),
    readRepoFile(migrationPaths.assignmentApply),
    readRepoFile(migrationPaths.eventApply),
    readRepoFile(migrationPaths.noopApply),
  ])

  for (const migration of files) {
    assert.match(migration, /app_private\.admin_apply_/)
  }
  assert.match(files[0], /create or replace function public\.admin_apply_import_batch/)
  assert.match(files[0], /security invoker/)
  assert.match(files[3], /revoke all on function app_private\.admin_apply_event_import_batch/)
  assert.match(files[4], /revoke all on function app_private\.admin_apply_noop_import_batch/)
})

test('admin workspace exposes all four application domains with scoped permissions', async () => {
  const [detailRoute, applyRoute, reviewRoute, detailPage, client] = await Promise.all([
    readRepoFile('src/app/api/admin/importaciones/[batchId]/route.ts'),
    readRepoFile('src/app/api/admin/importaciones/[batchId]/aplicar/route.ts'),
    readRepoFile('src/app/api/admin/importaciones/[batchId]/revisar/route.ts'),
    readRepoFile('src/features/importaciones/admin/ImportBatchDetailPage.tsx'),
    readRepoFile('src/features/importaciones/services/batch-import-admin-service.ts'),
  ])

  assert.match(detailRoute, /\['personas', 'parroquias', 'asignaciones', 'eventos'\]\.includes/)
  assert.match(detailRoute, /current_user_can_manage_entity/)
  assert.match(applyRoute, /permissionKey: 'imports\.apply'/)
  assert.match(applyRoute, /admin_apply_import_batch/)
  assert.match(reviewRoute, /permissionKey: 'imports\.review'/)
  assert.match(detailPage, /Guardar y revalidar/)
  assert.match(detailPage, /Aprobar lote/)
  assert.match(detailPage, /window\.confirm/)
  assert.match(client, /applyImportBatch/)
  assert.match(client, /\/aplicar/)
})