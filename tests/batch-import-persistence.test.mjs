import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('batch imports persist batches, rows, issues and future change audit records', async () => {
  const migration = await readRepoFile('supabase/migrations/20260711030000_prepare_persistent_import_batches.sql')

  assert.match(migration, /create table if not exists public\.import_batches/)
  assert.match(migration, /create table if not exists public\.import_batch_rows/)
  assert.match(migration, /create table if not exists public\.import_batch_row_issues/)
  assert.match(migration, /create table if not exists public\.import_batch_changes/)
  assert.match(migration, /alter table public\.import_batches enable row level security/)
  assert.match(migration, /file_sha256 text not null/)
  assert.match(migration, /scope_entity_id uuid/)
})

test('batch preparation validates and supports correction without applying canonical records', async () => {
  const migration = await readRepoFile('supabase/migrations/20260711030000_prepare_persistent_import_batches.sql')

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
  assert.doesNotMatch(migration, /set status = 'failed',[\s\S]*last_error = sqlerrm/)
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
