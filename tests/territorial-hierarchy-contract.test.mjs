import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const descendantsMigration = await readFile(
  new URL('../supabase/migrations/20260714173000_canonical_entity_descendants_from_structure_edges.sql', import.meta.url),
  'utf8',
)
const treeMigration = await readFile(
  new URL('../supabase/migrations/20260714173500_read_structure_tree_from_current_edges.sql', import.meta.url),
  'utf8',
)
const scopeUtils = await readFile(new URL('../src/lib/admin/scopeUtils.ts', import.meta.url), 'utf8')

test('entity descendants are projected from canonical territorial edges', () => {
  assert.match(descendantsMigration, /create or replace function public\.get_entity_descendants/i)
  assert.match(descendantsMigration, /join public\.structure_node_edges edge/i)
  assert.match(descendantsMigration, /st\.kind_key = 'territorial'/i)
  assert.match(descendantsMigration, /edge\.is_current = true/i)
  assert.match(descendantsMigration, /grant execute .* to authenticated/i)
  assert.doesNotMatch(descendantsMigration, /ecclesiastical_entities\s+.*parent_id/is)
})

test('structure tree resolves parentage from edges instead of the node compatibility column', () => {
  assert.match(treeMigration, /eligible_edges as/i)
  assert.match(treeMigration, /join eligible_edges edge on edge\.parent_node_id = parent\.node_id/i)
  assert.match(treeMigration, /not exists \(\s*select 1 from eligible_edges root_edge/is)
  assert.doesNotMatch(treeMigration, /join tree t on t\.node_id\s*=\s*c\.parent_node_id/i)
})

test('administrative scope expansion consumes the canonical descendant projection', () => {
  assert.match(scopeUtils, /rpc\('get_entity_descendants'/)
  assert.match(scopeUtils, /p_entity_id:\s*scope\.scopeEntityId/)
})
