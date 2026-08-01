import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath = 'supabase/migrations/20260801201208_harden_broad_admin_table_writes.sql'
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const protectedTables = [
  'canonical_event_types',
  'canonical_relationship_types',
  'canonical_relationships',
  'canonical_territories',
  'civil_geographies',
  'ecclesial_traditions',
  'ecclesiastical_groupings',
  'ecclesiastical_jurisdictions',
  'jurisdiction_types',
  'person_death_records',
  'person_private_validation',
  'structure_event_types',
  'structure_kinds',
  'structure_level_office_configurations',
  'sui_iuris_churches',
  'territory_intersections',
]

test('foundational tables reject direct authenticated writes', async () => {
  const migration = await read(migrationPath)

  for (const table of protectedTables) assert.match(migration, new RegExp(`public\\.${table}\\b`))

  assert.match(migration, /revoke insert, update, delete, truncate, references, trigger/)
  assert.match(migration, /from anon, authenticated/)
  assert.match(migration, /has_table_privilege\('authenticated',[\s\S]*?'INSERT'\)/)
  assert.match(migration, /cmd in \('ALL', 'INSERT', 'UPDATE', 'DELETE'\)/)
  assert.doesNotMatch(migration, /create or replace function internal\.current_user_has_admin_role/)
})

test('public suggestions retain create-only access', async () => {
  const migration = await read(migrationPath)

  assert.match(migration, /revoke update, delete, truncate, references, trigger[\s\S]*?public\.public_change_suggestions/)
  assert.match(migration, /drop policy if exists public_change_suggestions_admin_update/)
  assert.match(migration, /not has_table_privilege\('anon', 'public\.public_change_suggestions', 'INSERT'\)/)
  assert.doesNotMatch(migration, /drop policy if exists public_change_suggestions_public_insert/)
  assert.doesNotMatch(migration, /revoke insert[\s\S]{0,100}public\.public_change_suggestions/)
})

test('private validation keeps a read-only internal policy', async () => {
  const migration = await read(migrationPath)

  assert.match(migration, /drop policy if exists person_private_validation_admin_all/)
  assert.match(migration, /create policy person_private_validation_internal_select/)
  assert.match(migration, /for select\s+to authenticated/)
  assert.match(migration, /using \(\(select internal\.current_user_has_admin_role\(\)\)\)/)
})
