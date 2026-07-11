import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('office editor previews active assignment impact before update', async () => {
  const page = await read('src/features/organizacion/oficios/admin/OfficeConfigurationPage.tsx')
  const api = await read('src/app/api/admin/cargos/editar/route.ts')

  assert.match(page, /Editar reglas/)
  assert.match(page, /Previsualizar impacto/)
  assert.match(page, /incompatible_assignments/)
  assert.match(page, /confirm_incompatible_assignments/)
  assert.match(page, /nombramientos incompatibles/)
  assert.match(page, /Los nombramientos incompatibles permanecen abiertos para revisión/)
  assert.match(api, /admin_preview_office_rule_change/)
  assert.match(api, /admin_update_office_configuration/)
})

test('office edit submit action is derived from the native submitter', async () => {
  const page = await read('src/features/organizacion/oficios/admin/OfficeConfigurationPage.tsx')

  assert.match(page, /event\.nativeEvent as SubmitEvent/)
  assert.match(page, /name="edit_action" value="preview"/)
  assert.match(page, /name="edit_action" value="update"/)
  assert.doesNotMatch(page, /currentTarget: event\.currentTarget\.form/)
})

test('database blocks incompatible office edits unless explicitly confirmed', async () => {
  const migration = await read('supabase/migrations/20260711002545_preview_and_update_existing_office_rules.sql')

  assert.match(migration, /preview_office_rule_change/)
  assert.match(migration, /evaluate_person_against_proposed_office_rules/)
  assert.match(migration, /incompatible_assignments/)
  assert.match(migration, /confirm_incompatible_assignments/)
  assert.match(migration, /confirma expresamente para continuar/)
  assert.match(migration, /admin_update_office_configuration/)
  assert.match(migration, /audit_logs/)
})

test('office rule edit wrappers are invokers and anonymous access is revoked', async () => {
  const migration = await read('supabase/migrations/20260711002545_preview_and_update_existing_office_rules.sql')

  assert.match(migration, /public\.admin_preview_office_rule_change/)
  assert.match(migration, /public\.admin_update_office_configuration/)
  assert.match(migration, /security invoker/)
  assert.match(migration, /revoke all on function public\.admin_preview_office_rule_change\(uuid,jsonb\) from public,anon/)
  assert.match(migration, /revoke all on function public\.admin_update_office_configuration\(uuid,jsonb\) from public,anon/)
})
