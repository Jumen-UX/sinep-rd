import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('public person profile exposes only canonical ecclesial read contracts', async () => {
  const migration = await readRepoFile('supabase/migrations/20260710210612_public_person_ecclesial_profile_contract.sql')

  assert.match(migration, /create or replace view public\.person_public_ordination_history/)
  assert.match(migration, /create or replace view public\.person_public_clerical_history/)
  assert.match(migration, /security_invoker = true/g)
  assert.match(migration, /where oe\.record_status = 'active'/)
  assert.match(migration, /grant select on public\.person_public_ordination_history to anon, authenticated/)
  assert.match(migration, /grant select on public\.person_public_clerical_history to anon, authenticated/)
  assert.doesNotMatch(migration, /notes_internal/)
})

test('people API derives its clerical compatibility payload from canonical histories', async () => {
  const route = await readRepoFile('src/app/api/personas/route.ts')

  assert.match(route, /person_current_clerical_state/)
  assert.match(route, /person_public_ordination_history/)
  assert.match(route, /person_public_clerical_history/)
  assert.match(route, /person_current_episcopal_roles/)
  assert.match(route, /person_current_ecclesiastical_dignities/)
  assert.match(route, /buildCompatibilityClergy/)
  assert.doesNotMatch(route, /fetchSupabaseJson<Record<string, unknown>\[]>\('public_clergy'/)
})

test('public person page presents ordination role status and dignity as separate dimensions', async () => {
  const [page, serverView] = await Promise.all([
    readRepoFile('src/app/(public)/personas/[slug]/page.tsx'),
    readRepoFile('src/features/personas/PersonDetailServerView.tsx'),
  ])

  assert.match(page, /PersonDetailServerView/)
  assert.match(page, /loadPublicPersonDetail\(slug\)/)
  assert.doesNotMatch(page, /fetch\(/)
  assert.match(serverView, /Historia sacramental/)
  assert.match(serverView, /Grados del Orden/)
  assert.match(serverView, /Situación canónica actual/)
  assert.match(serverView, /Función episcopal actual/)
  assert.match(serverView, /Títulos y dignidades/)
  assert.match(serverView, /Historia canónica/)
  assert.match(serverView, /effective_person_type/)
  assert.doesNotMatch(serverView, /clergy\?\.priestly_ordination_date/)
  assert.doesNotMatch(serverView, /personTypeLabel\(person\.person_type\)/)
})
