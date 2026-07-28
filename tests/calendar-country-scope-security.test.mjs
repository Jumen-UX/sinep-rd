import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrations = {
  scope: '20260728162429_scope_calendar_records_by_country.sql',
  policyGrants: '20260728162604_grant_calendar_policy_helpers.sql',
  reader: '20260728162726_create_scoped_admin_calendar_reader.sql',
  configuration: '20260728163057_create_scoped_calendar_configuration_rpcs.sql',
  roleFix: '20260728163206_fix_event_reminder_role_catalog_validation.sql',
  generator: '20260728163434_generate_calendar_occurrences_by_scope.sql',
  notificationRls: '20260728164733_optimize_calendar_notification_rls.sql',
}

async function readMigration(fileName) {
  return readFile(new URL(`supabase/migrations/${fileName}`, repoRoot), 'utf8')
}

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`)
  assert.notEqual(start, -1, `${functionName} must exist`)
  const end = source.indexOf('create or replace function', start + functionName.length + 20)
  return source.slice(start, end === -1 ? source.length : end)
}

test('repository keeps the exact applied country-scoped calendar migration sequence', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))
  for (const fileName of Object.values(migrations)) {
    assert.equal(files.includes(fileName), true, `${fileName} must be committed`)
  }
})

test('calendar records resolve all canonical scopes without a global admin bypass', async () => {
  const migration = await readMigration(migrations.scope)

  for (const helper of [
    'app_private.event_occurrence_scope_entities',
    'app_private.commemorative_event_scope_entities',
    'app_private.event_reminder_scope_entities',
    'app_private.event_notification_log_scope_entities',
    'app_private.calendar_record_scope_entities',
    'app_private.current_user_can_manage_calendar_record',
    'app_private.current_user_can_view_calendar_record',
  ]) {
    assert.match(migration, new RegExp(`function ${helper.replaceAll('.', '\.')}`))
  }

  assert.match(migration, /person_scope_entities/)
  assert.match(migration, /organization_units/)
  assert.match(migration, /appointments/)
  assert.match(migration, /movements/)
  assert.match(migration, /events\.view_private/)
  assert.doesNotMatch(migration, /current_user_is_admin/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national/)
})

test('calendar RLS exposes public rows globally and non-public rows only through scoped helpers', async () => {
  const migration = await readMigration(migrations.scope)

  assert.match(migration, /create policy event_occurrences_select_scoped/)
  assert.match(migration, /visibility = 'public' and status = 'active'/)
  assert.match(migration, /current_user_can_view_calendar_record\('event_occurrences', id, visibility\)/)
  assert.match(migration, /create policy commemorative_events_select_scoped/)
  assert.match(migration, /current_user_can_view_calendar_record\('commemorative_events', id, visibility\)/)
  assert.match(migration, /create policy event_reminders_select_scoped/)
  assert.match(migration, /create policy event_visibility_settings_select_scoped/)
  assert.match(migration, /create policy event_notification_logs_select_scoped/)

  for (const table of [
    'event_occurrences',
    'commemorative_events',
    'event_reminders',
    'event_visibility_settings',
    'event_notification_logs',
  ]) {
    assert.match(
      migration,
      new RegExp(`revoke insert, update, delete on table public\\.${table} from anon, authenticated`),
    )
  }

  assert.match(migration, /alter view public\.public_calendar_events set \(security_invoker = true\)/)
})

test('notification RLS caches auth uid through an initplan', async () => {
  const migration = await readMigration(migrations.notificationRls)

  assert.match(migration, /recipient_user_id = \(select auth\.uid\(\)\)/)
  assert.match(migration, /current_user_can_manage_calendar_record\('events\.view', 'event_notification_logs', id\)/)
  assert.doesNotMatch(migration, /recipient_user_id = auth\.uid\(\)/)
})

test('organization unit occurrences are accepted and policy helper grants stay minimal', async () => {
  const scope = await readMigration(migrations.scope)
  const grants = await readMigration(migrations.policyGrants)

  assert.match(scope, /'organization_units'/)
  assert.match(scope, /event_occurrences_source_table_check/)
  assert.match(grants, /grant execute on function app_private\.current_user_can_view_calendar_record\(text, uuid, text\) to public/)
  assert.match(grants, /grant execute on function app_private\.current_user_can_manage_calendar_record\(text, text, uuid\) to authenticated/)
  assert.doesNotMatch(grants, /event_occurrence_scope_entities/)
})

test('administrative calendar reader is an invoker facade backed by a scoped definer', async () => {
  const migration = await readMigration(migrations.reader)
  const privateBody = functionBody(migration, 'app_private.rpc_definer__admin_list_calendar_events')
  const publicBody = functionBody(migration, 'public.admin_list_calendar_events')

  assert.match(privateBody, /security definer/)
  assert.match(privateBody, /current_user_has_permission\('events\.view'\)/)
  assert.match(privateBody, /current_user_can_manage_entity\('events\.view', v_scope_entity_id\)/)
  assert.match(privateBody, /calendar_entity_in_scope\(scope_row\.entity_id, v_scope_entity_id\)/)
  assert.match(privateBody, /events\.view_private/)
  assert.match(privateBody, /p_to > p_from \+ interval '5 years'/)
  assert.match(publicBody, /security invoker/)
  assert.match(publicBody, /rpc_definer__admin_list_calendar_events/)
  assert.doesNotMatch(migration, /current_user_is_admin|current_user_is_super_or_national/)
})

test('reminder and visibility writers use separate granular permissions and country checks', async () => {
  const migration = await readMigration(migrations.configuration)
  const reminder = functionBody(migration, 'app_private.rpc_definer__admin_save_event_reminder')
  const visibility = functionBody(migration, 'app_private.rpc_definer__admin_save_event_visibility_setting')
  const fix = await readMigration(migrations.roleFix)

  assert.match(reminder, /events\.manage_reminders/)
  assert.match(reminder, /resolve_entity_country_iso2\(v_scope_entity_id\)/)
  assert.match(reminder, /calendar_entity_in_scope\(v_unit_entity_id, v_scope_entity_id\)/)
  assert.match(reminder, /admin_write_audit_log/)
  assert.match(visibility, /events\.manage_visibility/)
  assert.match(visibility, /archdiocese','diocese','apostolic_vicariate/)
  assert.match(visibility, /not v_can_be_public and v_default_visibility = 'public'/)
  assert.match(visibility, /admin_write_audit_log/)

  assert.match(fix, /role_row\.is_active = true/)
  assert.match(fix, /where role_row\.id = v_recipient_role_id'/)

  for (const name of [
    'public.admin_save_event_reminder',
    'public.admin_list_event_reminders',
    'public.admin_save_event_visibility_setting',
    'public.admin_list_event_visibility_settings',
  ]) {
    assert.match(functionBody(migration, name), /security invoker/)
  }
})

test('scoped occurrence generation covers canonical sources and seals global generators', async () => {
  const migration = await readMigration(migrations.generator)
  const privateBody = functionBody(migration, 'app_private.rpc_definer__admin_generate_calendar_occurrences')
  const publicBody = functionBody(migration, 'public.admin_generate_calendar_occurrences')

  assert.match(privateBody, /current_user_has_permission\('events\.apply'\)/)
  assert.match(privateBody, /current_user_can_manage_entity\('events\.apply', v_scope_entity_id\)/)
  assert.match(privateBody, /resolve_entity_country_iso2\(v_scope_entity_id\)/)
  assert.match(privateBody, /calendar_entity_in_scope/)

  for (const source of [
    "'persons'",
    "'clergy_profiles'",
    "'appointments'",
    "'ecclesiastical_entities'",
    "'organization_units'",
  ]) {
    assert.match(privateBody, new RegExp(source))
  }

  assert.match(privateBody, /admin_write_audit_log/)
  assert.match(publicBody, /security invoker/)
  assert.match(migration, /revoke all on function public\.generate_event_occurrences\(integer\) from public, anon, authenticated/)
  assert.match(migration, /revoke all on function public\.generate_current_and_next_year_events\(\) from public, anon, authenticated/)
  assert.match(migration, /Generador global heredado reservado a operación técnica/)
  assert.doesNotMatch(migration, /current_user_is_admin|current_user_is_super_or_national/)
})
