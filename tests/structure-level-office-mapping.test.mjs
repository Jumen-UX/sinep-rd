import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../supabase/migrations/20260714025000_seed_canonical_level_office_mappings.sql',
  import.meta.url,
)

test('canonical level mappings constrain offices by ecclesiastical entity type', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  for (const rule of [
    "('archdiocese','obispo_diocesano',true)",
    "('diocese','vicario_general',false)",
    "('vicariate','vicario_episcopal',true)",
    "('pastoral_zone','archipreste_zona_pastoral',true)",
    "('parish','parroco_parroquial',true)",
    "('parish','administrador_parroquial',false)",
    "('parish','vicario_parroquial',false)",
    "('parish','diacono_adscrito_parroquial',false)",
  ]) {
    assert.match(sql, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  }

  assert.match(sql, /structure_level_office_configurations/i)
  assert.match(sql, /on conflict\(level_id,office_configuration_id\) do update/i)
  assert.match(sql, /canonical_level_mapping/i)
})

test('parish deacon office belongs to the parish ministry chart', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /where key='diacono_adscrito_parroquial'/i)
  assert.match(sql, /where key='parish_ministry'/i)
})
