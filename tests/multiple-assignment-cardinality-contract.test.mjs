import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
  new URL('../supabase/migrations/20260714043000_preserve_multiple_assignment_holders.sql', import.meta.url),
  'utf8',
)

test('multiple-holder offices require an explicit predecessor before closing another assignment', () => {
  assert.match(migration, /v_holder_cardinality = ''single''/)
  assert.match(migration, /predecessor_assignment_id explícito/)
  assert.doesNotMatch(migration, /holder_cardinality = 'multiple'.*close_previous_current/s)
})

test('current assignments reject exact duplicate person and scope without blocking multiple holders', () => {
  assert.match(migration, /create unique index if not exists position_assignments_current_person_scope_uidx/)
  assert.match(migration, /person_id,[\s\S]*office_configuration_id/)
  assert.match(migration, /where is_current = true/)
  assert.match(migration, /and person_id is not null/)
})

test('the Santo Domingo directory repair restores concurrent vicars and removes false succession links', () => {
  assert.match(migration, /holder_cardinality = 'multiple'/)
  assert.match(migration, /assignment_status = 'active'/)
  assert.match(migration, /actual_end_date = null/)
  assert.match(migration, /successor_assignment_id = null/)
  assert.match(migration, /replaced_by_assignment_id = null/)
  assert.match(migration, /Directorio de Parroquias%Arquidiócesis de Santo Domingo%Enero 2026/)
  assert.match(migration, /Nombramiento restaurado como titular coexistente/)
})
