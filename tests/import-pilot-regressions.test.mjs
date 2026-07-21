import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const paths = {
  matchFix: 'supabase/migrations/20260714033000_fix_exact_structure_import_noop_detection.sql',
  facades: 'supabase/migrations/20260714034000_harden_import_validate_and_apply_facades.sql',
  structureFixture: 'tests/fixtures/imports/parroquias-noop-pilot.csv',
  eventFixture: 'tests/fixtures/imports/eventos-canonical-pilot.csv',
  correctionFixture: 'tests/fixtures/imports/eventos-inline-correction-pilot.csv',
  eventApply: 'supabase/migrations/20260711203628_apply_historical_event_import_batches.sql',
  eventNoop: 'supabase/migrations/20260711213847_promote_exact_import_matches_to_noop.sql',
}

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

function sha256(value) {
  return createHash('sha256').update(value.replace(/\r\n/g, '\n'), 'utf8').digest('hex')
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
  const csv = await read(paths.structureFixture)
  const lines = csv.trimEnd().split('\n')

  assert.equal(lines.length, 4)
  assert.equal(sha256(csv), '1e6082f1039860363a074fb20ae243bc90bd2e76c47fa3e64eff1deeebc10e1c')
  assert.match(csv, /Parroquia Templo de Santo Domingo de Guzmán \(Convento Dominicos\)/)
  assert.match(csv, /Parroquia Nuestra Señora de la Altagracia \(Peralvillo\)/)
  assert.match(csv, /Parroquia Universitaria Santa María de la Anunciación/)
  assert.match(csv, /Zona Pastoral Colonial/)
  assert.match(csv, /Zona Pastoral Monte Plata/)
  assert.match(csv, /Zona Pastoral Central/)
})

test('the canonical event pilot creates reviewable history without applying structural state', async () => {
  const [csv, application] = await Promise.all([
    read(paths.eventFixture),
    read(paths.eventApply),
  ])

  assert.equal(csv.trimEnd().split('\n').length, 2)
  assert.equal(sha256(csv), 'ee7ccb1d119a30e918ab489e18726c412a6407130a17e27fe625634a9a876664')
  assert.match(csv, /^tipo_evento,fecha_efectiva,entidad,descripcion,titulo,fuente,url_fuente/m)
  assert.match(csv, /erection,1511-08-08,Arquidiócesis Metropolitana de Santo Domingo/)
  assert.match(csv, /Catholic-Hierarchy PDF de Santo Domingo/)
  assert.match(application, /public\.admin_create_event_draft/)
  assert.match(application, /created_event_status','pending_review'/)
  assert.match(application, /structural_state_modified',false/)
})

test('the inline correction fixture begins invalid and resolves to the existing event contract', async () => {
  const [csv, noopPromotion] = await Promise.all([
    read(paths.correctionFixture),
    read(paths.eventNoop),
  ])

  assert.equal(csv.trimEnd().split('\n').length, 2)
  assert.equal(sha256(csv), '846b4d2e48af5a343426a734ffaa5f778da2582716e1c979e6784e384c28b415')
  assert.match(csv, /Santo Domingo,,Erección de la Diócesis de Santo Domingo/)
  assert.match(noopPromotion, /existing_canonical_event/i)
  assert.match(noopPromotion, /exact_event_match/i)
  assert.match(noopPromotion, /target_operation='noop'/i)
})
