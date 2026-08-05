import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('public dashboard loads explicit jurisdiction geographic coverages', async () => {
  const source = await read('src/lib/public/dashboard.ts')

  assert.match(source, /export type JurisdictionGeographicCoverage/)
  assert.match(source, /jurisdiction_coverages: JurisdictionGeographicCoverage\[\]/)
  assert.match(source, /public_jurisdiction_geographic_coverages/)
  assert.match(source, /coverage_kind/)
  assert.match(source, /public-territorial-dashboard-data-v2/)
})

test('country filtering prefers explicit coverage and only falls back for uncovered jurisdictions', async () => {
  const [scope, page] = await Promise.all([
    read('src/features/public/buildPublicDashboardScope.ts'),
    read('src/app/(public)/page.tsx'),
  ])

  for (const source of [scope, page]) {
    assert.match(source, /jurisdictionsWithExplicitCoverage/)
    assert.match(source, /jurisdictionIdsForCountry/)
    assert.match(source, /jurisdictionIdsForCountry\.has\(item\.id\)/)
    assert.match(source, /!jurisdictionsWithExplicitCoverage\.has\(item\.id\)/)
  }

  assert.doesNotMatch(scope, /item\.country_iso2 \? item\.country_iso2 === country : country === 'DO'\s*\)\s*\)/)
})

test('country remains a discovery dimension rather than a canonical parent', async () => {
  const architecture = await read('docs/architecture/MOTOR_CONTEXTO_ECLESIAL_Y_COBERTURA.md')
  const migration = await read('supabase/migrations/20260805121500_add_jurisdiction_geographic_coverages.sql')

  assert.match(architecture, /puerta de entrada/i)
  assert.match(architecture, /no.*padre/i)
  assert.match(migration, /Countries are discovery dimensions, not canonical parents/)
  assert.match(migration, /coverage_kind,\n  is_current/)
  assert.match(migration, /'seat'/)
  assert.doesNotMatch(migration, /select[\s\S]*entity\.country_iso2,[\s\S]*'full'/)
})
