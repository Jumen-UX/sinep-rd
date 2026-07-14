import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
  new URL('../supabase/migrations/20260714044000_enrich_santo_domingo_erection_source.sql', import.meta.url),
  'utf8',
)

test('the Santo Domingo erection event receives an explicit secondary source URL', () => {
  assert.match(migration, /Erección de la Diócesis de Santo Domingo/)
  assert.match(migration, /date '1511-08-08'/)
  assert.match(migration, /Catholic-Hierarchy — Archdiocese of Santo Domingo/)
  assert.match(migration, /https:\/\/www\.catholic-hierarchy\.org\/diocese\/dsndo\.html/)
  assert.match(migration, /source_kind', 'secondary_reference'/)
})

test('documentary enrichment does not approve or apply the historical event', () => {
  assert.match(migration, /ce\.status = 'pending_review'/)
  assert.match(migration, /cea\.status = 'planned'/)
  assert.match(migration, /Requiere confirmación editorial o fuente primaria antes de aprobar/)
  assert.doesNotMatch(migration, /set status = 'approved'/)
  assert.doesNotMatch(migration, /set status = 'applied'/)
})
