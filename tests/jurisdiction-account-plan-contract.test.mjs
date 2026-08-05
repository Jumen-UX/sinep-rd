import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('jurisdiction account plan is the declared product core', async () => {
  const architecture = await read('docs/architecture/PLAN_DE_CUENTAS_JURISDICCIONAL.md')

  assert.match(architecture, /plan de cuentas jurisdiccional/i)
  assert.match(architecture, /Santa Sede/)
  assert.match(architecture, /país es una dimensión de descubrimiento/i)
  assert.match(architecture, /Quedan congelados/)
})

test('canonical migration separates jurisdictions from countries and internal structures', async () => {
  const migration = await read('supabase/migrations/20260805133000_create_jurisdiction_account_plan.sql')

  assert.match(migration, /create table if not exists public\.jurisdiction_accounts/)
  assert.match(migration, /create table if not exists public\.jurisdiction_account_edges/)
  assert.match(migration, /create table if not exists public\.jurisdiction_account_type_rules/)
  assert.match(migration, /JUR-HOLY-SEE/)
  assert.match(migration, /public_jurisdiction_account_tree/)
  assert.doesNotMatch(migration, /type\.key='country'/)
  assert.doesNotMatch(migration, /structure_nodes/)
  assert.doesNotMatch(migration, /organization_units/)
})

test('public navigation exposes only jurisdiction discovery and administration', async () => {
  const [navigation, shared, landing, page] = await Promise.all([
    read('src/features/public/PublicDashboardNavigation.ts'),
    read('src/features/public/PublicDashboardShared.tsx'),
    read('src/features/public/PublicLandingIntro.tsx'),
    read('src/app/(public)/page.tsx'),
  ])

  assert.match(navigation, /Plan de jurisdicciones/)
  assert.match(navigation, /Explorar por país/)
  assert.doesNotMatch(navigation, /Personas|Pastoral|Colegial|Directorio/)
  assert.match(shared, /title: 'Jurisdicciones'/)
  assert.doesNotMatch(shared, /title: 'Clero y agentes'|title: 'Pastoral'|title: 'Administración'|title: 'Colegial'/)
  assert.match(landing, /Un único centro/)
  assert.match(page, /const initialView: PublicView = 'territorial'/)
  assert.doesNotMatch(page, /loadPublicDashboardBundle/)
})
