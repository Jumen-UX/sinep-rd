import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const migration = fs.readFileSync('supabase/migrations/20260716064000_add_import_batches_to_review_queue.sql', 'utf8')
const service = fs.readFileSync('src/features/review/services/review-admin-service.ts', 'utf8')
const queuePage = fs.readFileSync('src/features/review/admin/ReviewQueuePage.tsx', 'utf8')
const qualityPanel = fs.readFileSync('src/features/data-quality/admin/ImportQualityQueuePanel.tsx', 'utf8')
const qualityRoute = fs.readFileSync('src/app/(admin)/admin/estado-fichas/page.tsx', 'utf8')

test('import batches join the scoped administrative review queue', () => {
  assert.match(migration, /'import_batch'::text as item_type/i)
  assert.match(migration, /batch\.status in \('needs_review','failed'\)/i)
  assert.match(migration, /batch\.status='validated' and batch\.review_status='pending'/i)
  assert.match(migration, /current_user_can_manage_entity\('imports\.review'/i)
  assert.match(migration, /'\{\}'::text\[\] as allowed_actions/i)
  assert.doesNotMatch(migration, /admin_review_item\(.*import_batch/is)
})

test('review UI sends import batches to their specialized workflow', () => {
  assert.match(service, /value === 'import_batch'/)
  assert.match(service, /\/admin\/importar\/\$\{encodeURIComponent\(item\.record_id\)\}/)
  assert.match(queuePage, /counts\.importBatches/)
  assert.match(queuePage, /Abrir y resolver/)
  assert.match(queuePage, /getReviewItemHref/)
})

test('data quality exposes the import backlog without duplicating its resolver', () => {
  assert.match(qualityPanel, /loadReviewQueue/)
  assert.match(qualityPanel, /item\.item_type === 'import_batch'/)
  assert.match(qualityPanel, /href="\/admin\/revision"/)
  assert.match(qualityPanel, /href="\/admin\/importar\/lotes"/)
  assert.match(qualityRoute, /ImportQualityQueuePanel/)
  assert.doesNotMatch(qualityPanel, /admin_review_item|admin_apply_import_batch|admin_update_import_batch_row/)
})
