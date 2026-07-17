import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
  new URL('../supabase/migrations/20260717013000_admin_contextual_kpis.sql', import.meta.url),
  'utf8',
)

test('contextual KPI RPC validates authentication scope type and entity ownership', () => {
  assert.match(migration, /auth\.uid\(\) is null/)
  assert.match(migration, /p_scope_type not in \('diocese', 'parish', 'entity'\)/)
  assert.match(migration, /current_user_has_scope_for_entity\(p_scope_entity_id\)/)
  assert.match(migration, /SCOPE_FORBIDDEN/)
})

test('contextual KPI RPC expands only the canonical territorial hierarchy', () => {
  assert.match(migration, /get_entity_descendants\(p_scope_entity_id, 10\)/)
  assert.doesNotMatch(migration, /parent_entity_id/)
  assert.doesNotMatch(migration, /legacy_/)
})

test('contextual KPI RPC returns the initial supported indicators without global fallback', () => {
  for (const key of [
    'territorial.active_entities',
    'territorial.active_parishes',
    'administrative.active_assignments',
    'administrative.pending_reviews',
  ]) {
    assert.match(migration, new RegExp(key.replace('.', '\\.')))
  }

  assert.match(migration, /entity\.id = any\(v_entity_ids\)/)
  assert.match(migration, /assignment\.ecclesiastical_entity_id = any\(v_entity_ids\)/)
  assert.match(migration, /request\.scope_entity_id = any\(v_entity_ids\)/)
})

test('contextual KPI RPC is not executable by anonymous clients', () => {
  assert.match(migration, /security invoker/i)
  assert.match(migration, /revoke all on function public\.get_admin_contextual_kpis\(text, uuid\) from anon/i)
  assert.match(migration, /grant execute on function public\.get_admin_contextual_kpis\(text, uuid\) to authenticated/i)
})
