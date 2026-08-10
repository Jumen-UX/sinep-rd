import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const page = fs.readFileSync('src/features/jurisdicciones/admin/JurisdictionExplorerPage.tsx', 'utf8')
const service = fs.readFileSync('src/features/jurisdictions/services/jurisdiction-admin-service.ts', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20260810195000_add_admin_current_jurisdiction_tree_reads.sql', 'utf8')

test('el editor administrativo representa únicamente el organigrama vigente', () => {
  assert.match(page, /Organigrama actual/)
  assert.match(page, /La historia no altera esta vista/)
  assert.doesNotMatch(page, /Fecha histórica/)
  assert.doesNotMatch(page, /Pastoral interna/)
  assert.doesNotMatch(page, /Geográfica civil/)
  assert.doesNotMatch(page, /Colegial/)
  assert.doesNotMatch(page, /asOfDate/)
})

test('el editor usa los límites transaccionales del motor jurisdiccional', () => {
  assert.match(page, /correctJurisdiction/)
  assert.match(page, /previewJurisdictionDependencyChange/)
  assert.match(page, /applyJurisdictionDependencyChange/)
  assert.match(page, /previewJurisdictionCreation/)
  assert.match(page, /applyJurisdictionCreation/)
  assert.match(page, /previewJurisdictionSuppression/)
  assert.match(page, /applyJurisdictionSuppression/)
  assert.match(page, /previewJurisdictionRestoration/)
  assert.match(page, /applyJurisdictionRestoration/)
  assert.match(page, /previewJurisdictionHistoricalEvent/)
  assert.match(page, /applyJurisdictionHistoricalEvent/)
})

test('la lectura administrativa vigente está encapsulada en RPC sin parámetro temporal', () => {
  assert.match(service, /admin_list_current_jurisdiction_tree/)
  assert.match(service, /admin_list_restorable_jurisdictions/)
  assert.match(migration, /where account\.is_current and account\.status='active'/)
  assert.doesNotMatch(migration, /p_as_of_date/)
  assert.match(migration, /current_user_has_admin_role\(\)/)
  assert.match(migration, /revoke execute on function public\.admin_list_current_jurisdiction_tree\(\) from public, anon/)
})
