import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = 'supabase/migrations/20260902125431_load_dominican_jurisdiction_baseline.sql'
const documentationPath = 'docs/operations/DOMINICAN_JURISDICTION_BASELINE.md'

const EXPECTED_SLUGS = [
  'provincia-eclesiastica-santo-domingo',
  'provincia-eclesiastica-santiago-de-los-caballeros',
  'arquidiocesis-santo-domingo',
  'arquidiocesis-santiago-de-los-caballeros',
  'diocesis-bani',
  'diocesis-barahona',
  'diocesis-la-vega',
  'diocesis-mao-montecristi',
  'diocesis-nuestra-senora-de-la-altagracia-higuey',
  'diocesis-puerto-plata',
  'diocesis-san-francisco-de-macoris',
  'diocesis-san-juan-de-la-maguana',
  'diocesis-san-pedro-de-macoris',
  'diocesis-stella-maris',
  'ordinariato-militar-republica-dominicana',
]

test('Dominican jurisdiction baseline replaces fabricated current truth with documented identities', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  for (const slug of EXPECTED_SLUGS) assert.match(sql, new RegExp(`'${slug}'`))

  assert.match(sql, /Conferencia del Episcopado Dominicano/)
  assert.match(sql, /press\.vatican\.va\/content\/salastampa\/it\/bollettino\/pubblico\/2025\/08\/27/)
  assert.match(sql, /press\.vatican\.va\/content\/salastampa\/es\/bollettino\/pubblico\/2017\/01\/02/)
  assert.match(sql, /catholic-hierarchy\.org\/country\/ddo2\.html/)
  assert.doesNotMatch(sql, /Nueva Esperanza|Puerto Claro|Cibao Verde|Bahía Serena|Monte Azul|Río Claro|Valle Alto|San Telmo/)
})

test('country is coverage metadata and never becomes the canonical parent', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /'JUR-HOLY-SEE','JUR-DO-PROV-SANTO-DOMINGO','contains'/)
  assert.match(sql, /'JUR-HOLY-SEE','JUR-DO-PROV-SANTIAGO','contains'/)
  assert.match(sql, /'JUR-HOLY-SEE','JUR-DO-MILITARY','specialized_jurisdiction'/)
  assert.match(sql, /insert into public\.jurisdiction_geographic_coverages/)
  assert.match(sql, /select e\.id,'DO',s\.coverage_kind/)
  assert.match(sql, /join public\.ecclesiastical_entities e on e\.slug=s\.slug/)
  assert.doesNotMatch(sql, /country.*parent_account_id/i)
  assert.doesNotMatch(sql, /'full'/)
})

test('baseline preserves the two metropolitan provinces and Stella Maris dependency', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /'JUR-DO-PROV-SANTO-DOMINGO','JUR-DO-ARCH-SANTO-DOMINGO','metropolitan_see'/)
  assert.match(sql, /'JUR-DO-PROV-SANTIAGO','JUR-DO-ARCH-SANTIAGO','metropolitan_see'/)
  assert.match(sql, /'JUR-DO-PROV-SANTO-DOMINGO','JUR-DO-DIO-STELLA-MARIS','suffragan_of','2025-08-27'/)
  assert.match(sql, /expected 16/)
  assert.match(sql, /expected 15/)
  assert.match(sql, /public diocese count %, expected 13/)
})

test('public diocese compatibility view remains invoker and keeps the military ordinariate visible', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /create or replace view public\.public_dioceses\s+with \(security_invoker=true\)/i)
  assert.match(sql, /parent_type\.key in \('ecclesiastical_province','country','holy_see'\)/)
  assert.match(sql, /ordinariato-militar-republica-dominicana/)
})

test('baseline documentation declares source hierarchy, scope and verified invariants', async () => {
  const documentation = await readFile(documentationPath, 'utf8')

  assert.match(documentation, /> Estado: vigente/)
  assert.match(documentation, /> Fecha de corte: 2026-09-02/)
  assert.match(documentation, /Fuentes primarias/i)
  assert.match(documentation, /Secundarias de contraste estructural/i)
  assert.match(documentation, /República Dominicana es una dimensión de cobertura geográfica y de descubrimiento, no el padre canónico/)
  assert.match(documentation, /circunscripciones públicas `DO`: \*\*13\*\*/)
  assert.match(documentation, /fixtures ficticios vigentes: \*\*0\*\*/)
})
