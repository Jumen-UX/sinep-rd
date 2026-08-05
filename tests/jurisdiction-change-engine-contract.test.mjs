import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = new URL('../supabase/migrations/20260805151500_create_jurisdiction_change_engine.sql', import.meta.url)
const architecturePath = new URL('../docs/architecture/MOTOR_DE_CAMBIOS_DEL_ORGANIGRAMA_JURISDICCIONAL.md', import.meta.url)

const read = (url) => readFile(url, 'utf8')

test('jurisdiction change engine separates public history from administrative corrections', async () => {
  const sql = await read(migrationPath)

  assert.match(sql, /origin in \('historical_event','organizational_change','administrative_correction'\)/)
  assert.match(sql, /publication_status in \('internal','draft','reviewed','published'\)/)
  assert.match(sql, /origin='historical_event'\s+and operation\.status='applied'\s+and operation\.publication_status='published'/s)
  assert.match(sql, /create or replace view public\.public_jurisdiction_history/)
  assert.match(sql, /create or replace view public\.admin_jurisdiction_change_operations/)
})

test('historical publication requires evidence and effective public content', async () => {
  const sql = await read(migrationPath)

  assert.match(sql, /event_type_id is not null\s+and effective_date is not null\s+and source_document_id is not null/s)
  assert.match(sql, /public_title is not null/)
  assert.match(sql, /public_summary is not null/)
  assert.match(sql, /status='applied'/)
})

test('effects are typed ordered and constrained to account or dependency mutations', async () => {
  const sql = await read(migrationPath)

  assert.match(sql, /create table if not exists public\.jurisdiction_change_effects/)
  assert.match(sql, /unique\(operation_id,sequence\)/)
  assert.match(sql, /target_type in \('account','edge'\)/)
  assert.match(sql, /'create_account'/)
  assert.match(sql, /'close_dependency'/)
  assert.match(sql, /before_state jsonb/)
  assert.match(sql, /after_state jsonb/)
})

test('applied operations are immutable and clients receive no direct writes', async () => {
  const sql = await read(migrationPath)

  assert.match(sql, /Las operaciones aplicadas o revertidas son inmutables/)
  assert.match(sql, /revoke all on public\.jurisdiction_change_operations from public/)
  assert.match(sql, /No insert, update or delete grants are given to anon\/authenticated/)
  assert.doesNotMatch(sql, /grant (insert|update|delete|all).*jurisdiction_change_operations.*authenticated/i)
})

test('historical tree regression is explicitly deferred while current organigram remains primary', async () => {
  const architecture = await read(architecturePath)

  assert.match(architecture, /organigrama vigente/)
  assert.match(architecture, /regresión histórica del árbol/i)
  assert.match(architecture, /segunda fase/i)
  assert.doesNotMatch(architecture, /El motor debe permitir reconstruir:[\s\S]*el organigrama en una fecha histórica/)
})
