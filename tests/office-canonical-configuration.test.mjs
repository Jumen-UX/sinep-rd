import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('office route delegates to canonical configuration feature', async () => {
  const route = await read('src/app/(admin)/admin/cargos/page.tsx')
  assert.equal(route.trim(), "export { default } from '@/features/organizacion/oficios/admin/OfficeConfigurationPage'")
})

test('office form exposes canonical eligibility and cardinality rules', async () => {
  const page = await read('src/features/organizacion/oficios/admin/OfficeConfigurationPage.tsx')
  for (const token of ['required_ordination_degree','allowed_clerical_statuses','allowed_episcopal_role_types','holder_cardinality','max_current_holders']) {
    assert.match(page, new RegExp(token))
  }
  assert.match(page, /Titular único/)
  assert.match(page, /Grado mínimo del Orden/)
  assert.doesNotMatch(page, /persons\.person_type/)
})

test('office writer validates and persists canonical rules', async () => {
  const migration = await read('supabase/migrations/20260711000648_save_canonical_office_rules_from_admin.sql')
  assert.match(migration, /apply_office_canonical_rules/)
  assert.match(migration, /required_ordination_degree=v_degree/)
  assert.match(migration, /allowed_clerical_statuses=v_statuses/)
  assert.match(migration, /holder_cardinality=v_cardinality/)
  assert.match(migration, /v_cardinality='single'/)
  assert.match(migration, /v_max := 1/)
})
