import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const detailPage = fs.readFileSync('src/features/importaciones/admin/ImportBatchDetailPage.tsx', 'utf8')
const fieldEditor = fs.readFileSync('src/features/importaciones/admin/ImportRowFieldEditor.tsx', 'utf8')
const rowRoute = fs.readFileSync('src/app/api/admin/importaciones/filas/[rowId]/route.ts', 'utf8')
const migration = fs.readFileSync('supabase/migrations/20260716054500_resolve_import_reference_uuid_selections.sql', 'utf8')

test('failed import rows can be edited and saved independently', () => {
  assert.match(detailPage, /editingRowId/)
  assert.match(detailPage, /startEditing\(row/)
  assert.match(detailPage, /updateImportBatchRow\(rowId, draftValues\)/)
  assert.match(detailPage, /Guardar y revalidar/)
  assert.match(detailPage, /Corregir fila/)
  assert.match(rowRoute, /admin_update_import_batch_row/)
  assert.match(rowRoute, /permissionKey: 'imports\.prepare'/)
})

test('reference fields require an explicit canonical selection', () => {
  assert.match(fieldEditor, /SearchableSelect/)
  assert.match(fieldEditor, /selectedCanonicalOption/)
  assert.match(fieldEditor, /Referencia canónica seleccionada/)
  assert.match(fieldEditor, /Referencia textual provisional/)
  assert.match(detailPage, /unresolvedReferenceFields/)
  assert.match(detailPage, /Selecciona referencias canónicas antes de guardar/)
})

test('canonical UUID selections are resolved with scope-aware matchers', () => {
  assert.match(migration, /ee\.id = input\.value::uuid/i)
  assert.match(migration, /person_state\.id = input\.value::uuid/i)
  assert.match(migration, /office\.id = input\.value::uuid/i)
  assert.match(migration, /current_user_can_manage_entity\('imports\.prepare', ee\.id\)/i)
  assert.match(migration, /current_user_can_manage_person\('imports\.prepare', person_state\.id\)/i)
  assert.match(migration, /revoke all on function app_private\.import_entity_matches/i)
})
