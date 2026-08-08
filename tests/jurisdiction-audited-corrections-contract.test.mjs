import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../supabase/migrations/20260808124500_add_audited_jurisdiction_corrections.sql',
  import.meta.url,
)

async function readMigration() {
  return readFile(migrationUrl, 'utf8')
}

test('jurisdiction corrections stay lightweight and atomically audited', async () => {
  const sql = await readMigration()

  assert.match(sql, /create or replace function public\.admin_correct_jurisdiction/i)
  assert.match(sql, /security definer/i)
  assert.match(sql, /current_user_has_admin_role\(\)/i)
  assert.match(sql, /for update/i)
  assert.match(sql, /p_expected_updated_at/i)
  assert.match(sql, /errcode = '40001'/i)

  assert.match(sql, /'name'/)
  assert.match(sql, /'official_name'/)
  assert.match(sql, /'latin_name'/)
  assert.match(sql, /'description'/)
  assert.match(sql, /'source_checked_at'/)
  assert.match(sql, /'notes'/)
  assert.match(sql, /'sort_order'/)

  for (const structuralField of [
    'parent_account_id',
    'child_account_id',
    'relationship_type',
    'canonical_status',
    'valid_from',
    'valid_to',
    'is_current',
    'entity_type_id',
    'erected_at',
    'suppressed_at',
  ]) {
    assert.doesNotMatch(
      sql,
      new RegExp(`['\"]${structuralField}['\"]\\s*,?\\s*$`, 'm'),
      `${structuralField} must not be accepted by the lightweight correction whitelist`,
    )
  }

  assert.match(sql, /'jurisdiction\.administrative_correction'/)
  assert.match(sql, /'changed_fields'/)
  assert.match(sql, /'before'/)
  assert.match(sql, /'after'/)
  assert.match(sql, /admin_write_audit_log/i)
  assert.match(sql, /'status', 'noop'/)

  assert.match(sql, /revoke execute[^;]*from public/i)
  assert.match(sql, /revoke execute[^;]*from anon/i)
  assert.match(sql, /grant execute[^;]*to authenticated/i)
})

test('administrative corrections are explicitly excluded from public historical workflow', async () => {
  const sql = await readMigration()

  assert.doesNotMatch(sql, /insert into public\.jurisdiction_change_operations/i)
  assert.doesNotMatch(sql, /public_jurisdiction_history/i)
  assert.doesNotMatch(sql, /publication_status/i)
  assert.doesNotMatch(sql, /historical_event/i)
})
