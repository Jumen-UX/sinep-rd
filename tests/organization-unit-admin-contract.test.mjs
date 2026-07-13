import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../supabase/migrations/20260714024000_operationalize_organization_units.sql',
  import.meta.url,
)

async function readMigration() {
  return readFile(migrationUrl, 'utf8')
}

test('organization units are written only through the scoped canonical RPC', async () => {
  const sql = await readMigration()

  assert.match(sql, /function internal\.admin_save_organization_unit\(payload jsonb\)/i)
  assert.match(sql, /function app_private\.rpc_definer__admin_save_organization_unit\(payload jsonb\)/i)
  assert.match(sql, /function public\.admin_save_organization_unit\(payload jsonb\)/i)
  assert.match(sql, /security definer/i)
  assert.match(sql, /current_user_can_manage_entity\(v_permission,v_entity_id\)/i)
  assert.match(sql, /revoke all on function app_private\.rpc_definer__admin_save_organization_unit\(jsonb\) from public,anon,authenticated/i)
  assert.match(sql, /grant execute on function public\.admin_save_organization_unit\(jsonb\) to authenticated,service_role/i)
  assert.match(sql, /revoke insert,update,delete,truncate,references,trigger on public\.organization_units from anon,authenticated/i)
})

test('organization unit hierarchy validates scope and prevents cycles', async () => {
  const sql = await readMigration()

  assert.match(sql, /parent\.organization_chart_id=v_chart_id/i)
  assert.match(sql, /parent\.ecclesiastical_entity_id=v_entity_id/i)
  assert.match(sql, /with recursive descendants/i)
  assert.match(sql, /La jerarquía produciría un ciclo organizativo/i)
  assert.match(sql, /La fecha final no puede ser anterior a la fecha inicial/i)
  assert.match(sql, /structure_engine_slugify/i)
})

test('pastoral permissions and audits distinguish create update approval and publication', async () => {
  const sql = await readMigration()

  for (const permission of [
    'pastorals.create_proposal',
    'pastorals.update_proposal',
    'pastorals.approve',
    'pastorals.publish',
  ]) {
    assert.match(sql, new RegExp(permission.replace('.', '\\.'), 'i'))
  }

  for (const action of [
    'pastorals.organization_unit.created',
    'pastorals.organization_unit.updated',
    'pastorals.organization_unit.approved',
    'pastorals.organization_unit.published',
  ]) {
    assert.match(sql, new RegExp(action.replaceAll('.', '\\.'), 'i'))
  }

  assert.match(sql, /public\.create_audit_log/i)
  assert.match(sql, /'organization_unit_id',v_id/i)
})

test('Santo Domingo pilot creates one internal root and attaches the diocesan pastorals', async () => {
  const sql = await readMigration()

  assert.match(sql, /arquidiocesis-metropolitana-de-santo-domingo/i)
  assert.match(sql, /pastorales-diocesanas-arquidiocesis-metropolitana-de-santo-domingo/i)
  assert.match(sql, /'Pastorales diocesanas — Arquidiócesis Metropolitana de Santo Domingo'/i)
  assert.match(sql, /set parent_unit_id=v_root_id/i)
  assert.match(sql, /and pastoral_area_id is not null/i)
  assert.match(sql, /0,'internal','draft',true/i)
})
