import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrationName = '20260727220252_scope_entity_management_by_country.sql'

test('entity country-scope migration matches the applied Supabase version', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))
  assert.equal(files.includes(migrationName), true)
})

test('entity management requires effective permission and matching assignment country', async () => {
  const migration = await readFile(
    new URL(`supabase/migrations/${migrationName}`, repoRoot),
    'utf8',
  )

  assert.match(migration, /v_target_country_iso2 := app_private\.resolve_entity_country_iso2/)
  assert.match(migration, /not app_private\.current_user_can_access_country\(v_target_country_iso2\)/)
  assert.match(migration, /assignment\.country_iso2 = v_target_country_iso2/)
  assert.match(migration, /permission_row\.key = p_permission_key/)
  assert.match(migration, /assignment\.scope_type = 'national'/)
  assert.match(migration, /app_private\.current_user_has_role\(array\['super_admin'\]\)/)

  const helperSection = migration.slice(
    migration.indexOf('create or replace function app_private.current_user_can_manage_entity'),
    migration.indexOf('create or replace function app_private.import_entity_matches'),
  )
  assert.doesNotMatch(helperSection, /r\.key in \('super_admin', 'national_admin'\)/)
  assert.doesNotMatch(helperSection, /scope_type in \('global', 'national'\)/)
})

test('entity match search no longer treats national administrators as global', async () => {
  const migration = await readFile(
    new URL(`supabase/migrations/${migrationName}`, repoRoot),
    'utf8',
  )

  const searchSection = migration.slice(
    migration.indexOf('create or replace function app_private.import_entity_matches'),
    migration.indexOf('create or replace function app_private.rpc_definer__admin_save_ecclesiastical_entity'),
  )

  assert.match(searchSection, /current_user_can_manage_entity\('imports\.prepare', entity_row\.id\)/)
  assert.doesNotMatch(searchSection, /current_user_is_super_or_national/)
})

test('new entities and jurisdictions inherit and validate the parent country', async () => {
  const migration = await readFile(
    new URL(`supabase/migrations/${migrationName}`, repoRoot),
    'utf8',
  )

  assert.match(migration, /El país de la nueva entidad no coincide con su entidad superior/)
  assert.match(migration, /El país de la nueva jurisdicción no coincide con su jurisdicción superior/)
  assert.match(migration, /jsonb_set\([\s\S]*?'\{country_iso2\}'/)
  assert.match(migration, /Solo un superadministrador puede crear una entidad país/)
  assert.match(migration, /Debes seleccionar una jurisdicción superior/)
  assert.doesNotMatch(migration, /Solo la administración nacional puede crear jurisdicciones mayores/)
})
