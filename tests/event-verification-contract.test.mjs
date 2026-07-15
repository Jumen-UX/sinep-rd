import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('event verification keeps documentary evidence separate from review status', async () => {
  const source = await readRepoFile('src/features/events/services/event-verification.ts')

  assert.match(source, /normalizeSourceVerification/)
  assert.match(source, /confirmado_oficial/)
  assert.match(source, /verification_status !== 'verified'/)
  assert.match(source, /pendiente_documento/)
})

test('event drafts persist source date verification scope and effective date', async () => {
  const service = await readRepoFile('src/features/events/services/event-draft-admin-service.ts')
  const page = await readRepoFile('src/features/events/admin/EventDraftPage.tsx')

  assert.match(service, /source_checked_at: verification\.source_checked_at/)
  assert.match(service, /verification_status: verification\.verification_status/)
  assert.match(service, /effective_date: effectiveDate/)
  assert.match(page, /Fecha de revisión/)
  assert.match(page, /Estado de verificación/)
  assert.match(page, /Alcance/)
})

test('database contract stores verification and never applies a new draft', async () => {
  const migration = await readRepoFile('supabase/migrations/20260715223000_unify_canonical_event_verification.sql')

  assert.match(migration, /add column if not exists source_checked_at date/)
  assert.match(migration, /add column if not exists verification_status text not null default 'pending_review'/)
  assert.match(migration, /'pending_review',auth\.uid\(\)/)
  assert.match(migration, /verified_source_requires_name_and_date/)
  assert.match(migration, /has_effective_date/)
  assert.doesNotMatch(migration, /status,'applied'/)
})
