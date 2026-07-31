import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('people directory remains international without inventing unsupported country filtering', async () => {
  const [page, directories, migration] = await Promise.all([
    read('src/app/(public)/personas/page.tsx'),
    read('src/lib/public/directories.ts'),
    read('supabase/migrations/20260714050000_include_historical_public_persons.sql'),
  ])

  assert.match(page, /Directorio público internacional/)
  assert.match(page, /Catálogo público internacional/)
  assert.match(page, /<span>Todos los países<\/span>/)
  assert.match(page, /El contexto territorial se consulta en cada ficha y en sus asignaciones públicas/)
  assert.doesNotMatch(page, /<span>República Dominicana<\/span>/)
  assert.doesNotMatch(page, /params\.pais|country_iso2|country_name/)

  assert.doesNotMatch(directories, /PersonDirectoryItem[\s\S]*country_iso2/)
  assert.doesNotMatch(migration, /country_iso2|country_name/)
})
