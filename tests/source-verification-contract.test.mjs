import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('source verification contract validates evidence before confirmed verification', async () => {
  const contract = await readRepoFile('src/features/shared/source-verification.ts')

  assert.match(contract, /pending_review/)
  assert.match(contract, /verified/)
  assert.match(contract, /rejected/)
  assert.match(contract, /unverified/)
  assert.match(contract, /La URL de la fuente debe usar HTTP o HTTPS/)
  assert.match(contract, /Una verificación confirmada requiere nombre de fuente y fecha de revisión/)
  assert.match(contract, /source_name: sourceName/)
  assert.match(contract, /source_checked_at: sourceCheckedAt/)
})

test('canonical person and assignment APIs normalize and audit source evidence', async () => {
  const personRoute = await readRepoFile('src/app/api/admin/persona-canonica/route.ts')
  const assignmentRoute = await readRepoFile('src/app/api/admin/asignacion/route.ts')

  for (const route of [personRoute, assignmentRoute]) {
    assert.match(route, /normalizeSourceVerification/)
    assert.match(route, /\.\.\.sourceVerification/)
    assert.match(route, /source_name: sourceVerification\.source_name/)
    assert.match(route, /source_checked_at: sourceVerification\.source_checked_at/)
    assert.match(route, /verification_status: sourceVerification\.verification_status/)
    assert.doesNotMatch(route, /source_url: sourceVerification\.source_url/)
  }
})

test('canonical histories and appointments persist source verification fields', async () => {
  const canonicalMigration = await readRepoFile(
    'supabase/migrations/20260710220313_unified_canonical_person_registration_engine.sql',
  )
  const assignmentPage = await readRepoFile(
    'src/features/appointments/admin/AssignmentManagerPage.tsx',
  )

  assert.match(canonicalMigration, /source_name, source_url, source_checked_at/)
  assert.match(canonicalMigration, /verification_status/)
  assert.match(canonicalMigration, /ordination_events/)
  assert.match(canonicalMigration, /clerical_status_history/)
  assert.match(canonicalMigration, /clerical_incardinations/)
  assert.match(assignmentPage, /name="source_name"/)
  assert.match(assignmentPage, /name="source_url"/)
  assert.match(assignmentPage, /name="source_checked_at"/)
  assert.match(assignmentPage, /verification_status: 'pending_review'/)
})
