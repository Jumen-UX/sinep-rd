import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration = fs.readFileSync('supabase/migrations/20260716062000_add_audited_import_logical_reversal.sql', 'utf8')
const route = fs.readFileSync('src/app/api/admin/importaciones/[batchId]/revertir/route.ts', 'utf8')
const service = fs.readFileSync('src/features/importaciones/services/import-reversal-admin-service.ts', 'utf8')

test('logical reversal preserves history and never deletes canonical records', () => {
  assert.match(migration, /create table if not exists public\.import_batch_reversals/i)
  assert.match(migration, /blocked_manual_canonical_resolution/i)
  assert.match(migration, /record_only/i)
  assert.match(migration, /restore_event_record/i)
  assert.match(migration, /retire_unapplied_event/i)
  assert.doesNotMatch(migration, /delete from public\.(persons|ecclesiastical_entities|position_assignments|canonical_events)/i)
})

test('reversal requires permission scope reason and an applied batch', () => {
  assert.match(migration, /current_user_has_permission\('imports\.apply'\)/i)
  assert.match(migration, /current_user_can_manage_entity\('imports\.apply'/i)
  assert.match(migration, /v_batch\.status<>'applied'/i)
  assert.match(migration, /reason text not null/i)
  assert.match(route, /reason\.length < 10/i)
})

test('event restoration remains audited and permission constrained', () => {
  assert.match(migration, /current_user_has_permission\('events\.approve'\)/i)
  assert.match(migration, /admin_correct_canonical_event/i)
  assert.match(migration, /import\.batch\.reversed/i)
  assert.match(migration, /import\.batch\.reversal_blocked/i)
})

test('public endpoint and client service expose the controlled workflow', () => {
  assert.match(route, /admin_reverse_import_batch/i)
  assert.match(route, /permissionKey: 'imports\.apply'/i)
  assert.match(service, /reverseImportBatch/i)
  assert.match(service, /status: 'completed' \| 'blocked'/i)
})
