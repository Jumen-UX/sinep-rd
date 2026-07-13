import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const paths = {
  matchFix: 'supabase/migrations/20260714033000_fix_exact_structure_import_noop_detection.sql',
  facades: 'supabase/migrations/20260714034000_harden_import_validate_and_apply_facades.sql',
  fixture: 'tests/fixtures/imports/parroquias-noop-pilot.csv',
}

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('structure imports classify exact contextual entities as noop', async () => {
  const sql = await read(paths.matchFix)

  assert.match(sql, /promote_exact_structure_matches_to_noop/i)
  assert.match(sql, /join public\.ecclesiastical_entities ee/i)
  assert.match(sql, /sn\.template_id=.*template_id/is)
  assert.match(sql, /sn\.parent_node_id=.*parent_node_id/is)
  assert.match(sql, /sn\.level_id=.*level_id/is)
  assert.match(sql, /lower\(btrim\(ee\.name\)\)/i)
  assert.match(sql, /target_operation='noop'/i)
  assert.match(sql, /exact_contextual_entity_match/i)
  assert.match(sql, /matched_entity_id/i)
  assert.match(sql, /return app_private\.promote_exact_import_matches_to_noop/i)
  assert.match(sql, /validate_import_batch_with_contract[\s\S]*promote_exact_structure_matches_to_noop/i)
  assert.match(sql, /revoke all on function app_private\.promote_exact_structure_matches_to_noop\(uuid\) from public,anon,authenticated/i)
})

test('validation and application facades cross private helpers without exposing them', async () => {
  const sql = await read(paths.facades)

  assert.match(sql, /create or replace function public\.admin_validate_import_batch/i)
  assert.match(sql, /create or replace function public\.admin_apply_import_batch/i)
  assert.equal((sql.match(/security definer/gi) ?? []).length, 2)
  assert.match(sql, /validate_import_batch_with_contract\(p_batch_id\)/i)
  assert.match(sql, /admin_apply_import_batch\(payload\)/i)
  assert.match(sql, /revoke all on function public\.admin_validate_import_batch\(uuid\) from public,anon/i)
  assert.match(sql, /revoke all on function public\.admin_apply_import_batch\(jsonb\) from public,anon/i)
  assert.match(sql, /grant execute on function public\.admin_validate_import_batch\(uuid\) to authenticated,service_role/i)
  assert.match(sql, /grant execute on function public\.admin_apply_import_batch\(jsonb\) to authenticated,service_role/i)
})

test('the Santo Domingo noop pilot fixture is stable and reproducible', async () => {
  const csv = await read(paths.fixture)
  const lines = csv.trimEnd().split('\n')
  const digest = createHash('sha256').update(csv, 'utf8').digest('hex')

  assert.equal(lines.length, 4)
  assert.equal(digest, '1e6082f1039860363a074fb20ae243bc90bd2e76c47fa3e64eff1deeebc10e1c')
  assert.match(csv, /Parroquia Templo de Santo Domingo de Guzmán \(Convento Dominicos\)/)
  assert.match(csv, /Parroquia Nuestra Señora de la Altagracia \(Peralvillo\)/)
  assert.match(csv, /Parroquia Universitaria Santa María de la Anunciación/)
  assert.match(csv, /Zona Pastoral Colonial/)
  assert.match(csv, /Zona Pastoral Monte Plata/)
  assert.match(csv, /Zona Pastoral Central/)
})
