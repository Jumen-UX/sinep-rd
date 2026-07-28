import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrations = {
  review: '20260728140808_scope_review_workflows_by_country.sql',
  publishPerson: '20260728140934_align_assignment_person_publish_scope.sql',
}

async function readMigration(fileName) {
  return readFile(new URL(`supabase/migrations/${fileName}`, repoRoot), 'utf8')
}

test('repository keeps the exact applied review migration sequence', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))

  for (const fileName of Object.values(migrations)) {
    assert.equal(files.includes(fileName), true, `${fileName} must be committed`)
  }
})

test('review records and change requests fail closed when entity scope cannot be resolved', async () => {
  const migration = await readMigration(migrations.review)

  assert.match(migration, /current_user_can_review_change_request\([\s\S]*p_change_request_id uuid/)
  assert.match(migration, /current_user_can_review_record\([\s\S]*p_record_id uuid/)
  assert.match(migration, /current_user_has_role\(array\['super_admin'\]\)/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national/)
  assert.doesNotMatch(migration, /current_user_can\([\s\S]*'national'/)
})

test('review queue scopes assignments, change requests and import batches by canonical entity', async () => {
  const migration = await readMigration(migrations.review)

  assert.match(migration, /current_user_can_review_record\(\s*'appointments\.view'/)
  assert.match(migration, /current_user_can_review_change_request\(\s*'change_requests\.view'/)
  assert.match(migration, /batch\.scope_entity_id is not null/)
  assert.match(migration, /current_user_can_manage_entity\('imports\.review', batch\.scope_entity_id\)/)
  assert.doesNotMatch(migration, /batch\.scope_entity_id is null[\s\S]*current_user_has_permission/)
})

test('reviewable assignments and import batches require an explicit scope', async () => {
  const migration = await readMigration(migrations.review)

  assert.match(migration, /position_assignments_scope_required/)
  assert.match(migration, /ecclesiastical_entity_id is not null or organization_unit_id is not null/)
  assert.match(migration, /import_batches_scope_entity_required/)
  assert.match(migration, /scope_entity_id is not null/)
  assert.match(migration, /validate constraint position_assignments_scope_required/)
  assert.match(migration, /validate constraint import_batches_scope_entity_required/)
})

test('review mutations use the canonical audit pipeline', async () => {
  const migration = await readMigration(migrations.review)

  const auditCalls = migration.match(/perform public\.create_audit_log\(/g) ?? []
  assert.ok(auditCalls.length >= 5, 'all review mutation branches must use create_audit_log')
  assert.doesNotMatch(migration, /insert into public\.audit_logs/)
  assert.match(migration, /'scope_entity_id', v_scope_entity_id/)
  assert.match(migration, /'organization_unit_id', v_request\.organization_unit_id/)
})

test('publishing a person follows the assignment canonical entity instead of legacy scope access', async () => {
  const migration = await readMigration(migrations.publishPerson)

  assert.match(migration, /review_record_scope_entity\(\s*'position_assignments'/)
  assert.match(migration, /current_user_can_manage_entity\(\s*'people\.publish'/)
  assert.match(migration, /current_user_has_role\(array\['super_admin'\]\)/)
  assert.doesNotMatch(migration, /current_user_has_scope_access/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national/)
})
