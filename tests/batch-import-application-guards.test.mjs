import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('applied, applying and cancelled batches cannot be revalidated', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260711033703_protect_applied_import_batches_from_revalidation.sql',
  )

  assert.match(migration, /for update/)
  assert.match(migration, /v_status in \('applying', 'applied', 'cancelled'\)/)
  assert.match(migration, /El lote ya no admite revalidación/)
  assert.match(migration, /app_private\.validate_import_batch\(p_batch_id\)/)
  assert.match(migration, /app_private\.finalize_person_import_validation\(p_batch_id\)/)
})
