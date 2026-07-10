import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('person change proposals use the versioned canonical payload', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260710212816_canonical_person_change_proposal_workflow.sql',
  )

  assert.match(migration, /'schema_version', 2/)
  assert.match(migration, /'proposal_kind', 'canonical_person'/)
  assert.match(migration, /'pending_review'/)
  assert.match(migration, /apply_person_canonical_proposal/)
  assert.match(migration, /insert into public\.ordination_events/)
  assert.match(migration, /insert into public\.clerical_status_history/)
  assert.match(migration, /insert into public\.clerical_incardinations/)
  assert.match(migration, /insert into public\.religious_profiles/)
  assert.match(migration, /insert into public\.episcopal_roles/)
  assert.match(migration, /insert into public\.person_ecclesiastical_dignities/)
  assert.doesNotMatch(migration, /set\s+person_type\s*=/i)
  assert.doesNotMatch(migration, /'person_type'\s*,\s*nullif\(p_proposed_data/i)
})

test('empty auxiliary values are removed before the canonical workflow', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260710213850_normalize_empty_legacy_person_proposal_fields.sql',
  )

  assert.match(migration, /jsonb_strip_nulls\(jsonb_build_object/)
  assert.match(migration, /nullif\(p_proposed_data #>> '\{legacy_profile,priest_type\}', ''\)/)
  assert.match(migration, /nullif\(p_proposed_data #>> '\{legacy_profile,deacon_type\}', ''\)/)
  assert.match(migration, /grant execute .* to authenticated/is)
  assert.match(migration, /revoke all .* from public, anon/is)
})

test('canonical editor preserves visibility of existing ordinations', async () => {
  const viewMigration = await readRepoFile(
    'supabase/migrations/20260710214101_preserve_ordination_visibility_in_canonical_editor.sql',
  )
  const normalizationMigration = await readRepoFile(
    'supabase/migrations/20260710214224_normalize_canonical_proposal_visibility.sql',
  )
  const service = await readRepoFile('src/features/personas/services/person-admin-service.ts')

  assert.match(viewMigration, /oe\.visibility/)
  assert.match(viewMigration, /security_invoker = true/)
  assert.match(normalizationMigration, /existing\.visibility/)
  assert.match(normalizationMigration, /existing\.record_status = 'active'/)
  assert.match(service, /verification_status,visibility/)
  assert.match(service, /visibility: string \| null/)
})

test('canonical edit form does not expose person type as an ordination control', async () => {
  const page = await readRepoFile('src/features/personas/admin/EditPersonProposalPage.tsx')

  assert.match(page, /Propuesta canónica de cambio/)
  assert.match(page, /Grados del Orden/)
  assert.match(page, /Estado clerical vigente/)
  assert.match(page, /Incardinación/)
  assert.match(page, /Vida consagrada/)
  assert.match(page, /Función episcopal/)
  assert.match(page, /Dignidades eclesiásticas/)
  assert.match(page, /mode: 'keep'/)
  assert.match(page, /getPersonCanonicalFormOptions/)
  assert.doesNotMatch(page, /Tipo de persona/)
  assert.doesNotMatch(page, /updateField\('person_type'/)
  assert.doesNotMatch(page, /form\.person_type/)
})

test('person admin service loads selectable canonical references', async () => {
  const service = await readRepoFile('src/features/personas/services/person-admin-service.ts')

  assert.match(service, /schema_version: 2/)
  assert.match(service, /proposal_kind: 'canonical_person'/)
  assert.match(service, /from\('public_ecclesiastical_entities'\)/)
  assert.match(service, /from\('person_public_directory'\)/)
  assert.match(service, /eq\('has_episcopate', true\)/)
  assert.match(service, /principal_ordainer_person_id/)
  assert.match(service, /incardination_entity_id/)
})

test('review page explains canonical operations instead of printing person type changes', async () => {
  const reviewPage = await readRepoFile('src/app/(admin)/admin/solicitudes/[id]/page.tsx')

  assert.match(reviewPage, /CanonicalProposalReview/)
  assert.match(reviewPage, /Operaciones sobre los grados del Orden/)
  assert.match(reviewPage, /Vigencias propuestas/)
  assert.match(reviewPage, /proposal_kind === 'canonical_person'/)
  assert.match(reviewPage, /\['pending_review', 'needs_changes'\]/)
  assert.doesNotMatch(reviewPage, /person_type: 'Tipo de persona'/)
  assert.doesNotMatch(reviewPage, /\['submitted', 'pending_review', 'in_review'\]/)
})
