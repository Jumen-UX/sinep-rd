import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

function extractFunction(sql, qualifiedName) {
  const marker = `create or replace function ${qualifiedName}`
  const start = sql.indexOf(marker)
  assert.notEqual(start, -1, `No se encontró la función ${qualifiedName}`)

  const candidates = [
    sql.indexOf('\ncreate or replace function ', start + marker.length),
    sql.indexOf('\nrevoke all on function ', start + marker.length),
    sql.indexOf('\ngrant execute on function ', start + marker.length),
    sql.length,
  ].filter((index) => index >= 0)

  return sql.slice(start, Math.min(...candidates))
}

test('associated person publication is checked by the public review gateway', async () => {
  const canonical = await readRepoFile('supabase/migrations/20260714022000_reassert_organization_unit_security_contracts.sql')
  const gatewaySql = await readRepoFile('supabase/migrations/20260710163459_harden_review_person_publication_scope.sql')
  const helper = extractFunction(canonical, 'app_private.current_user_can_publish_assignment_person')
  const gateway = extractFunction(gatewaySql, 'public.admin_review_item')

  assert.match(helper, /people\.publish/)
  assert.match(helper, /current_user_can_manage_entity/)
  assert.match(helper, /current_user_has_scope_access/)
  assert.match(helper, /organization_unit/)
  assert.match(helper, /current_user_is_super_or_national/)
  assert.doesNotMatch(helper, /pastoral_entity/)

  assert.match(gateway, /security\s+definer/i)
  assert.match(gateway, /publish_person/)
  assert.match(gateway, /current_user_can_publish_assignment_person/)
  assert.match(gateway, /return app_private\.admin_review_item\(payload\)/)

  assert.match(
    gatewaySql,
    /revoke all on function app_private\.admin_review_item\(jsonb\)[\s\S]*from public, anon, authenticated;/,
  )
  assert.match(gatewaySql, /grant execute on function public\.admin_review_item\(jsonb\) to authenticated;/)
})

test('legacy review entry points delegate through the hardened gateway', async () => {
  const sql = await readRepoFile('supabase/migrations/20260710163459_harden_review_person_publication_scope.sql')
  const importedAppointment = extractFunction(sql, 'public.admin_review_imported_appointment')
  const changeRequest = extractFunction(sql, 'public.admin_review_change_request')

  assert.match(importedAppointment, /public\.admin_review_item\(/)
  assert.doesNotMatch(importedAppointment, /app_private\.admin_review_item\(/)
  assert.match(changeRequest, /public\.admin_review_item\(/)
  assert.doesNotMatch(changeRequest, /app_private\.admin_review_item\(/)
})
