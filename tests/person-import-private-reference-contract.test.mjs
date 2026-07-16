import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
  new URL('../supabase/migrations/20260713234500_align_person_import_reference_with_private_identity.sql', import.meta.url),
  'utf8',
)
const importRoute = await readFile(
  new URL('../src/app/(admin)/admin/importar/page.tsx', import.meta.url),
  'utf8',
)
const importPage = await readFile(
  new URL('../src/features/importaciones/admin/AdminBatchImportPage.tsx', import.meta.url),
  'utf8',
)
const importContract = await readFile(
  new URL('../src/features/importaciones/contracts/import-batch-contract.ts', import.meta.url),
  'utf8',
)

test('person noop matching uses the canonical private internal reference contract', () => {
  assert.match(migration, /from public\.person_private_validation ppv/)
  assert.match(migration, /ppv\.internal_reference_code/)
  assert.match(migration, /array_agg\(ppv\.person_id order by ppv\.person_id\)/)
  assert.doesNotMatch(migration, /p\.internal_reference_code/)
})

test('historical persons receive missing private reference rows without name-derived identity', () => {
  assert.match(migration, /insert into public\.person_private_validation\(person_id,internal_reference_code,created_by,biography_notes\)/)
  assert.match(migration, /public\.generate_person_internal_code_for_type/)
  assert.match(migration, /left join public\.person_private_validation ppv on ppv\.person_id=p\.id/)
  assert.match(migration, /where ppv\.person_id is null/)
})

test('person CSV template exposes codigo_referencia as an optional idempotency key', () => {
  assert.match(importRoute, /from '@\/features\/importaciones'/)
  assert.match(importPage, /IMPORT_DOMAIN_OPTIONS/)
  assert.match(importPage, /getImportDomainContract\(importType\)/)
  assert.match(importContract, /personas:\s*\{/)
  assert.match(importContract, /columns:\s*\['codigo_referencia', 'tipo_persona'/)
  assert.match(importContract, /codigo_referencia es opcional para altas nuevas/)
  assert.match(importContract, /requiredColumns:\s*\['tipo_persona', 'primer_nombre', 'primer_apellido'\]/)
})
