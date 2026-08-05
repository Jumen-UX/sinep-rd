import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('ecclesial context separates canonical hierarchy from geographic discovery', async () => {
  const contract = await read('docs/architecture/MOTOR_CONTEXTO_ECLESIAL_Y_COBERTURA.md')

  assert.match(contract, /el país no es necesariamente el padre canónico/i)
  assert.match(contract, /modelo tipo plan de cuentas/i)
  assert.match(contract, /relación explícita, muchos-a-muchos e histórica/i)
  assert.match(contract, /country_iso2.*compatibilidad/is)
  assert.match(contract, /contenido pedagógico tipo wiki/i)
})

test('jurisdiction coverage migration preserves legacy country only as seat evidence', async () => {
  const migration = await read('supabase/migrations/20260805121500_add_jurisdiction_geographic_coverages.sql')

  assert.match(migration, /create table if not exists public\.jurisdiction_geographic_coverages/)
  assert.match(migration, /coverage_kind in \('full','partial','personal','specialized','seat','historical'\)/)
  assert.match(migration, /'seat'/)
  assert.match(migration, /Representa país de sede o asociación heredada/)
  assert.doesNotMatch(migration, /entity\.country_iso2,\s*'full'/s)
  assert.match(migration, /public_jurisdiction_geographic_coverages/)
  assert.match(migration, /Does not imply country-to-jurisdiction canonical parentage/)
})

test('direct authenticated reads remain limited to current public coverage', async () => {
  const migration = await read('supabase/migrations/20260805122500_restrict_jurisdiction_coverage_reads.sql')

  assert.match(migration, /to authenticated/)
  assert.match(migration, /visibility = 'public'/)
  assert.match(migration, /is_current/)
  assert.match(migration, /valid_from is null or valid_from <= current_date/)
  assert.doesNotMatch(migration, /visibility <> 'confidential'/)
})
