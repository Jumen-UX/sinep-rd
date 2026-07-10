import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('public directory derives Holy Orders and keeps religious life transversal', async () => {
  const migration = await readRepoFile('supabase/migrations/20260710211134_canonical_public_person_directory.sql')
  const privilegeFix = await readRepoFile('supabase/migrations/20260710211356_fix_canonical_public_person_directory_privileges.sql')

  assert.match(migration, /create or replace view public\.person_public_directory/)
  assert.match(migration, /security_invoker = true/)
  assert.match(migration, /pes\.effective_person_type as person_type/)
  assert.match(migration, /\(rp\.person_id is not null\) as is_religious/)
  assert.match(migration, /grant select \(person_id, religious_life_type, canonical_status\)/)
  assert.doesNotMatch(migration, /grant select \([^)]*notes_private/)

  assert.match(privilegeFix, /left join public\.religious_profiles rp on rp\.person_id = pes\.id/)
  assert.doesNotMatch(privilegeFix, /religious_profiles\.updated_at/)
})

test('people list and dashboard no longer classify clergy from persons.person_type', async () => {
  const peopleApi = await readRepoFile('src/app/api/personas/route.ts')
  const summaryApi = await readRepoFile('src/app/api/dashboard/resumen/route.ts')

  assert.match(peopleApi, /'person_public_directory'/)
  assert.match(peopleApi, /filters\.is_religious = 'eq\.true'/)
  assert.doesNotMatch(peopleApi, /fetchSupabaseJson<Record<string, unknown>\[]>\('persons', buildListFilters/)

  assert.match(summaryApi, /fetchSupabaseJson<PersonSummaryRow\[]>\('person_public_directory'/)
  assert.match(summaryApi, /religious: people\.filter\(\(item\) => item\.is_religious\)\.length/)
})

test('public directory explains overlapping ecclesial dimensions', async () => {
  const page = await readRepoFile('src/app/(public)/personas/page.tsx')

  assert.match(page, /grado del Orden, condición laical y vida consagrada/)
  assert.match(page, /una persona de vida consagrada también puede ser diácono, sacerdote u obispo/)
  assert.match(page, /personTypeLabel\(item\.person_type, item\.is_religious\)/)
  assert.match(page, /Vida consagrada/)
})
