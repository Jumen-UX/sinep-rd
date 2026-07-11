import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const importMigrationPath = 'supabase/migrations/20260711025340_prepare_persistent_import_batches.sql'
const reviewMigrationPath = 'supabase/migrations/20260711030620_review_persistent_import_batches.sql'
const applicationMigrationPath = 'supabase/migrations/20260711032519_apply_person_import_batches.sql'
const reviewCapabilityMigrationPath = 'supabase/migrations/20260711032920_align_import_review_application_capability.sql'

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('batch imports persist batches, rows, issues and future change audit records', async () => {
  const migration = await readRepoFile(importMigrationPath)

  assert.match(migration, /create table if not exists public\.import_batches/)
  assert.match(migration, /create table if not exists public\.import_batch_rows/)
  assert.match(migration, /create table if not exists public\.import_batch_row_issues/)
  assert.match(migration, /create table if not exists public\.import_batch_changes/)
  assert.match(migration, /alter table public\.import_batches enable row level security/)
  assert.match(migration, /file_sha256 text not null/)
  assert.match(migration, /scope_entity_id uuid/)
})

test('batch preparation validates and supports correction before canonical application', async () => {
  const migration = await readRepoFile(importMigrationPath)

  assert.match(migration, /admin_prepare_import_batch/)
  assert.match(migration, /admin_validate_import_batch/)
  assert.match(migration, /admin_update_import_batch_row/)
  assert.match(migration, /duplicate_row_in_batch/)
  assert.match(migration, /relation_not_found/)
  assert.match(migration, /possible_existing_person/)
  assert.match(migration, /possible_existing_entity/)
  assert.match(migration, /current_user_can_manage_person\('imports\.prepare'/)
  assert.match(migration, /is_valid_iso_date/)
  assert.match(migration, /from public\.country_catalog/)
  assert.match(migration, /invalid_person_type/)
  assert.match(migration, /invalid_entity_type/)
  assert.match(migration, /invalid_event_type/)
  assert.match(migration, /else 'validated'/)
  assert.match(migration, /canonical_records_modified', false/)
  assert.doesNotMatch(migration, /create or replace function public\.admin_apply_import_batch/)
})

test('privileged batch implementations stay outside the exposed public schema', async () => {
  const scopeHelper = await readRepoFile('supabase/migrations/20260711025044_current_user_root_jurisdiction_helper.sql')
  const hardening = await readRepoFile('supabase/migrations/20260711025611_harden_import_batch_rpc_exposure.sql')
  const application = await readRepoFile(applicationMigrationPath)

  assert.match(scopeHelper, /app_private\.current_user_root_jurisdiction_id/)
  assert.match(scopeHelper, /public\.current_user_root_jurisdiction_id/)
  assert.match(hardening, /alter function public\.admin_prepare_import_batch\(jsonb\) set schema app_private/)
  assert.match(hardening, /alter function public\.admin_update_import_batch_row\(uuid, jsonb\) set schema app_private/)
  assert.match(application, /app_private\.admin_apply_import_batch/)
  assert.match(application, /create or replace function public\.admin_apply_import_batch/)
  assert.match(application, /language sql[\s\S]*security invoker/)
})

test('validated batches require an explicit scoped editorial decision', async () => {
  const migration = await readRepoFile(reviewMigrationPath)
  const capability = await readRepoFile(reviewCapabilityMigrationPath)

  assert.match(migration, /'imports\.review'/)
  assert.match(migration, /review_status text not null default 'pending'/)
  assert.match(migration, /review_status in \('pending', 'approved', 'rejected'\)/)
  assert.match(migration, /reset_import_batch_review_on_validation/)
  assert.match(migration, /new\.validated_at is distinct from old\.validated_at/)
  assert.match(migration, /app_private\.admin_review_import_batch/)
  assert.match(migration, /canonical_records_modified', false/)
  assert.match(capability, /v_application_available := v_batch\.import_type = 'personas'/)
  assert.match(capability, /current_user_has_permission\('imports\.apply'\)/)
  assert.match(capability, /'can_apply', v_can_apply/)
})

test('approved person batches apply transactionally and idempotently through the canonical engine', async () => {
  const migration = await readRepoFile(applicationMigrationPath)

  assert.match(migration, /'imports\.apply'/)
  assert.match(migration, /invalid_person_status_for_type/)
  assert.match(migration, /invalid_person_visibility/)
  assert.match(migration, /v_batch\.import_type <> 'personas'/)
  assert.match(migration, /v_batch\.review_status <> 'approved'/)
  assert.match(migration, /internal\.admin_save_canonical_person/)
  assert.match(migration, /insert into public\.import_batch_changes/)
  assert.match(migration, /'import\.person\.created'/)
  assert.match(migration, /'import\.batch\.applied'/)
  assert.match(migration, /'idempotent_replay', true/)
  assert.match(migration, /exception when others/)
  assert.match(migration, /'canonical_records_modified', false/)
})

test('admin import page sends complete CSV rows to the protected preparation API', async () => {
  const page = await readRepoFile('src/app/(admin)/admin/importar/page.tsx')
  const parser = await readRepoFile('src/features/importaciones/services/csv-preview.ts')
  const client = await readRepoFile('src/features/importaciones/services/batch-import-admin-service.ts')
  const route = await readRepoFile('src/app/api/admin/importaciones/preparar/route.ts')

  assert.match(page, /prepareImportBatch/)
  assert.match(page, /Preparar y validar lote/)
  assert.match(page, /Esta acción no crea ni modifica registros canónicos/)
  assert.match(parser, /records: Record<string, string>\[\]/)
  assert.match(parser, /crypto\.subtle\.digest\('SHA-256'/)
  assert.match(client, /\/api\/admin\/importaciones\/preparar/)
  assert.match(route, /permissionKey: 'imports\.prepare'/)
  assert.match(route, /admin_prepare_import_batch/)
  assert.match(route, /rows\.length > 5000/)
})

test('batch workspace supports review, correction and scoped canonical application', async () => {
  const listRoute = await readRepoFile('src/app/api/admin/importaciones/route.ts')
  const detailRoute = await readRepoFile('src/app/api/admin/importaciones/[batchId]/route.ts')
  const validateRoute = await readRepoFile('src/app/api/admin/importaciones/[batchId]/validar/route.ts')
  const reviewRoute = await readRepoFile('src/app/api/admin/importaciones/[batchId]/revisar/route.ts')
  const applyRoute = await readRepoFile('src/app/api/admin/importaciones/[batchId]/aplicar/route.ts')
  const rowRoute = await readRepoFile('src/app/api/admin/importaciones/filas/[rowId]/route.ts')
  const historyPage = await readRepoFile('src/features/importaciones/admin/ImportBatchHistoryPage.tsx')
  const detailPage = await readRepoFile('src/features/importaciones/admin/ImportBatchDetailPage.tsx')
  const client = await readRepoFile('src/features/importaciones/services/batch-import-admin-service.ts')
  const historyRoute = await readRepoFile('src/app/(admin)/admin/importar/lotes/page.tsx')
  const detailPageRoute = await readRepoFile('src/app/(admin)/admin/importar/[batchId]/page.tsx')
  const layout = await readRepoFile('src/app/(admin)/admin/importar/layout.tsx')

  for (const route of [listRoute, detailRoute, validateRoute, rowRoute]) {
    assert.match(route, /permissionKey: 'imports\.prepare'/)
  }

  assert.match(reviewRoute, /permissionKey: 'imports\.review'/)
  assert.match(applyRoute, /permissionKey: 'imports\.apply'/)
  assert.match(applyRoute, /admin_apply_import_batch/)
  assert.match(listRoute, /review_status/)
  assert.match(detailRoute, /can_review/)
  assert.match(detailRoute, /can_apply/)
  assert.match(detailRoute, /application_rpc_available/)
  assert.match(detailRoute, /current_user_can_manage_entity/)
  assert.match(detailRoute, /from\('import_batch_rows'\)/)
  assert.match(detailRoute, /from\('import_batch_row_issues'\)/)
  assert.match(validateRoute, /admin_validate_import_batch/)
  assert.match(reviewRoute, /admin_review_import_batch/)
  assert.match(rowRoute, /admin_update_import_batch_row/)
  assert.match(historyPage, /Aprobación explícita/)
  assert.match(detailPage, /Guardar y revalidar/)
  assert.match(detailPage, /Aprobar lote/)
  assert.match(detailPage, /Rechazar lote/)
  assert.match(detailPage, /Aplicar lote de personas/)
  assert.match(detailPage, /window\.confirm/)
  assert.match(client, /applyImportBatch/)
  assert.match(client, /\/aplicar/)
  assert.match(historyRoute, /ImportBatchHistoryPage/)
  assert.match(detailPageRoute, /ImportBatchDetailPage/)
  assert.match(layout, /Historial y revisión/)
})
