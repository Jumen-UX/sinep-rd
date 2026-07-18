import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
  'supabase/migrations/20260718160000_optimize_public_query_indexes.sql',
  'utf8',
)

test('public query indexes are partial idempotent and aligned with verified filters', () => {
  assert.equal((migration.match(/create index if not exists/g) ?? []).length, 3)

  assert.match(
    migration,
    /ecclesiastical_entities_public_active_type_name_idx[\s\S]*\(entity_type_id, name\)[\s\S]*where status = 'active' and visibility = 'public'/,
  )
  assert.match(
    migration,
    /entity_relationships_current_active_child_idx[\s\S]*\(child_entity_id, parent_entity_id\)[\s\S]*where is_current = true and status = 'active'/,
  )
  assert.match(
    migration,
    /organization_units_public_current_chart_order_idx[\s\S]*\(organization_chart_id, sort_order, name\)[\s\S]*where status = 'active' and visibility = 'public' and is_current = true/,
  )
})

test('index migration avoids redundant public person and global status indexes', () => {
  assert.doesNotMatch(migration, /create index[^;]+persons/i)
  assert.doesNotMatch(migration, /\(status\)\s*;/)
  assert.doesNotMatch(migration, /\(visibility\)\s*;/)
})
