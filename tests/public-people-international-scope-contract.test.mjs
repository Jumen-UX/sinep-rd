import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('people directory remains international and filters by current pastoral service', async () => {
  const [page, filters, directories, territorialMigration] = await Promise.all([
    read('src/app/(public)/personas/page.tsx'),
    read('src/features/public/PersonTerritorialFilters.tsx'),
    read('src/lib/public/directories.ts'),
    read('supabase/migrations/20260731025000_public_person_territorial_assignments.sql'),
  ])

  assert.match(page, /Directorio público internacional/)
  assert.match(page, /Todos los países/)
  assert.match(page, /país indica dónde sirven, no su nacionalidad/i)
  assert.doesNotMatch(page, /<span>República Dominicana<\/span>/)

  assert.match(filters, /label="País de servicio"/)
  assert.match(filters, /label="Diócesis o jurisdicción"/)
  assert.match(filters, /label="Parroquia"/)
  assert.match(filters, /params\.set\('pais'/)
  assert.match(filters, /params\.set\('diocesis'/)
  assert.match(filters, /params\.set\('parroquia'/)

  assert.match(directories, /public_person_territorial_assignments/)
  assert.match(directories, /country_iso2/)
  assert.match(directories, /diocese_id/)
  assert.match(directories, /parish_id/)
  assert.match(territorialMigration, /where ppa\.is_current = true/)
  assert.doesNotMatch(territorialMigration, /birth_country|nationality/i)
})
