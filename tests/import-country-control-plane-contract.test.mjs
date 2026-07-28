import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrations = {
  control: '20260728153739_scope_import_control_plane_by_country.sql',
  application: '20260728154339_validate_import_application_rows_by_country.sql',
  validation: '20260728154944_enforce_import_validation_country_consistency.sql',
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

test('repository keeps the exact applied import lifecycle migration sequence', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))
  for (const fileName of Object.values(migrations)) {
    assert.equal(files.includes(fileName), true, `${fileName} must be committed`)
  }
})

test('public import entry points are invokers backed by private definers', async () => {
  const migration = await readMigration(migrations.control)

  for (const name of [
    'admin_prepare_import_batch',
    'admin_validate_import_batch',
    'admin_review_import_batch',
    'admin_update_import_batch_row',
    'admin_reverse_import_batch',
    'admin_apply_import_batch',
  ]) {
    const publicBody = functionBody(migration, `public.${name}`)
    assert.match(publicBody, /security invoker/)
    assert.match(publicBody, new RegExp(`app_private\\.rpc_definer__${name}`))
  }

  assert.match(migration, /security definer/)
  assert.match(migration, /revoke all on function app_private\.admin_prepare_import_batch\(jsonb\) from public, anon, authenticated/)
  assert.match(migration, /revoke all on function app_private\.admin_reverse_import_batch\(jsonb\) from public, anon, authenticated/)
  assert.match(migration, /revoke all on function app_private\.admin_apply_import_batch\(jsonb\) from public, anon, authenticated/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national/)
})

test('prepare validate review update reverse and apply require an explicit manageable entity', async () => {
  const migration = await readMigration(migrations.control)

  for (const permission of ['imports.prepare', 'imports.review', 'imports.apply']) {
    assert.match(
      migration,
      new RegExp(`current_user_can_manage_entity\\('${permission.replace('.', '\\.')}', v_scope_entity_id\\)`),
    )
  }

  assert.match(migration, /v_scope_entity_id is null/)
  assert.match(migration, /current_user_root_jurisdiction_id\(\)/)
  assert.match(migration, /events\.approve dentro del país del lote/)
})

test('application assertion covers every import domain and operation class', async () => {
  const migration = await readMigration(migrations.application)
  const assertion = functionBody(migration, 'app_private.assert_import_batch_rows_in_scope')

  for (const domain of ['personas', 'parroquias', 'asignaciones', 'eventos']) {
    assert.match(assertion, new RegExp(`v_batch\\.import_type = '${domain}'`))
  }

  assert.match(assertion, /target_operation not in \('create','update','noop'\)/)
  assert.match(assertion, /person_scope_entities\(v_row\.target_record_id\)/)
  assert.match(assertion, /person_scope_entities\(v_person_id\)/)
  assert.match(assertion, /review_record_scope_entity\('position_assignments', v_row\.target_record_id\)/)
  assert.match(assertion, /canonical_event_scope_entity_id\(v_row\.target_record_id\)/)
  assert.match(assertion, /v_row_country is distinct from v_batch_country/)
  assert.match(assertion, /structures\.manage/)
  assert.match(assertion, /appointments\.create_proposal/)
  assert.match(assertion, /events\.approve/)
})

test('dispatcher validates all rows before noop mixed update or create engines run', async () => {
  const migration = await readMigration(migrations.application)
  const dispatcher = functionBody(migration, 'app_private.rpc_definer__admin_apply_import_batch')

  const assertionIndex = dispatcher.indexOf('assert_import_batch_rows_in_scope')
  const dispatchIndex = dispatcher.indexOf('admin_apply_import_batch(payload)')

  assert.notEqual(assertionIndex, -1)
  assert.notEqual(dispatchIndex, -1)
  assert.equal(assertionIndex < dispatchIndex, true)
  assert.match(dispatcher, /current_user_can_manage_entity\('imports\.apply', v_scope_entity_id\)/)
  assert.doesNotMatch(dispatcher, /current_user_is_super_or_national/)
})

test('person internal references are filtered by batch country without leaking candidate ids', async () => {
  const migration = await readMigration(migrations.validation)
  const body = functionBody(migration, 'app_private.promote_person_reference_matches_to_noop')

  assert.match(body, /person_scope_entities\(ppv\.person_id\)/)
  assert.match(body, /resolve_entity_country_iso2\(person_scope\.entity_id\) = v_batch_country/)
  assert.match(body, /current_user_can_manage_entity\('imports\.prepare', person_scope\.entity_id\)/)
  assert.match(body, /person_reference_out_of_country/)
  assert.match(body, /not_available_in_country/)
  assert.match(body, /jsonb_build_object\('match_count', v_match->'match_count'\)/)
  assert.doesNotMatch(body, /candidate_ids.*details/s)
})

test('structure validation clears targets when row country differs from batch country', async () => {
  const migration = await readMigration(migrations.validation)
  const body = functionBody(migration, 'app_private.enforce_structure_import_country_consistency')

  assert.match(body, /structure_country_mismatch/)
  assert.match(body, /upper\(coalesce\(row_data\.normalized_data->>'pais_iso2',''\)\) <> v_country::text/)
  assert.match(body, /target_operation = null/)
  assert.match(body, /target_record_id = null/)
  assert.match(body, /refresh_import_batch_validation_summary\(p_batch_id\)/)
})

test('country consistency runs inside the canonical validation dispatcher', async () => {
  const migration = await readMigration(migrations.validation)
  const body = functionBody(migration, 'app_private.validate_import_batch_with_contract')

  assert.match(body, /current_user_can_manage_entity\('imports\.prepare', v_scope_entity_id\)/)
  assert.match(body, /promote_person_reference_matches_to_noop\(p_batch_id\)/)
  assert.match(body, /enforce_structure_import_country_consistency\(p_batch_id\)/)
  assert.match(body, /promote_exact_import_matches_to_noop\(p_batch_id\)/)
  assert.match(body, /classify_event_import_updates\(p_batch_id\)/)
  assert.doesNotMatch(body, /current_user_is_super_or_national/)
})
