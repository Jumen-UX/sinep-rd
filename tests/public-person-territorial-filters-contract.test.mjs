import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('people directory supports searchable pastoral territory filters without duplicating people', async () => {
  const [page, filters, directories, migration, styles] = await Promise.all([
    read('src/app/(public)/personas/page.tsx'),
    read('src/features/public/PersonTerritorialFilters.tsx'),
    read('src/lib/public/directories.ts'),
    read('supabase/migrations/20260730225500_public_person_territorial_assignments.sql'),
    read('src/app/person-territorial-filters.css'),
  ])

  assert.match(page, /loadPersonTerritorialAssignments\(\)/)
  assert.match(page, /País de servicio/)
  assert.match(page, /país indica dónde sirven, no su nacionalidad/i)
  assert.match(page, /new Map<string, PersonTerritorialAssignment\[\]>/)
  assert.match(page, /assignmentsByPerson\.has\(item\.id\)/)
  assert.match(page, /personAssignments\.slice\(0, 3\)/)
  assert.match(page, /selectedCountry=/)
  assert.match(page, /selectedDiocese=/)
  assert.match(page, /selectedParish=/)

  assert.match(filters, /PublicSearchableSelect/)
  assert.match(filters, /label="País de servicio"/)
  assert.match(filters, /label="Diócesis o jurisdicción"/)
  assert.match(filters, /label="Parroquia"/)
  assert.match(filters, /disabled=\{!selectedCountry\}/)
  assert.match(filters, /disabled=\{!selectedDiocese\}/)
  assert.match(filters, /params\.set\('pais'/)
  assert.match(filters, /params\.set\('diocesis'/)
  assert.match(filters, /params\.set\('parroquia'/)

  assert.match(directories, /public_person_territorial_assignments/)
  assert.match(directories, /country_iso2/)
  assert.match(directories, /diocese_id/)
  assert.match(directories, /parish_id/)

  assert.match(migration, /where ppa\.is_current = true/)
  assert.match(migration, /where ee\.id = coalesce\(ppa\.diocese_id, ppa\.direct_entity_id\)/)
  assert.doesNotMatch(migration, /birth_country|nationality/i)

  assert.match(styles, /grid-template-columns: repeat\(3/)
  assert.match(styles, /@media \(max-width: 920px\)/)
  assert.match(styles, /grid-template-columns: 1fr/)
})
