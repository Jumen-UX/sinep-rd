import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public territorial person directory is based on current pastoral assignments', async () => {
  const [migration, directories, route] = await Promise.all([
    read('supabase/migrations/20260731025000_public_person_territorial_assignments.sql'),
    read('src/lib/public/directories.ts'),
    read('src/app/api/personas/territorial/route.ts'),
  ])

  assert.match(migration, /public_person_territorial_assignments/)
  assert.match(migration, /public_position_assignments_with_hierarchy/)
  assert.match(migration, /ppa\.is_current = true/)
  assert.match(migration, /ppa\.assignment_status = 'active'/)
  assert.match(migration, /country_iso2/)
  assert.match(migration, /diocese_id/)
  assert.match(migration, /parish_id/)
  assert.match(migration, /ámbito de servicio, no nacionalidad/i)
  assert.match(migration, /grant select .* anon, authenticated/i)

  assert.match(directories, /loadPersonTerritorialAssignments/)
  assert.match(directories, /countryIso2/)
  assert.match(directories, /dioceseId/)
  assert.match(directories, /parishId/)
  assert.match(directories, /personType/)
  assert.match(directories, /public_person_territorial_assignments/)
  assert.doesNotMatch(directories, /birth_date|nationality|document_number/)

  assert.match(route, /searchParams\.get\('pais'\)/)
  assert.match(route, /searchParams\.get\('diocesis'\)/)
  assert.match(route, /searchParams\.get\('parroquia'\)/)
  assert.match(route, /searchParams\.get\('tipo'\)/)
  assert.match(route, /countryPattern/)
  assert.match(route, /uuidPattern/)
  assert.match(route, /Math\.min\(Number\(limitValue\), 200\)/)
})
