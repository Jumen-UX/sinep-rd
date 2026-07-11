import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('admin route delegates to canonical incompatibility feature', async () => {
  const route = await read('src/app/(admin)/admin/incompatibilidades-canonicas/page.tsx')
  assert.equal(route.trim(), "export { default } from '@/features/organizacion/oficios/admin/AssignmentCanonicalIncompatibilityPage'")
})

test('queue exposes safe review actions and no automatic closure', async () => {
  const page = await read('src/features/organizacion/oficios/admin/AssignmentCanonicalIncompatibilityPage.tsx')
  for (const token of ['Volver a comprobar','Dejar pendiente con nota','Aceptar excepción justificada','Cerrar nombramiento']) {
    assert.match(page, new RegExp(token))
  }
  assert.match(page, /Ningún nombramiento se cierra automáticamente/)
  assert.match(page, /window\.confirm/)
})

test('database queue reuses canonical eligibility and audits resolutions', async () => {
  const reader = await read('supabase/migrations/20260711004244_list_assignment_canonical_incompatibilities.sql')
  const resolver = await read('supabase/migrations/20260711004322_resolve_assignment_canonical_incompatibility.sql')
  assert.match(reader, /evaluate_position_assignment_eligibility/)
  assert.match(reader, /is_current=true/)
  assert.match(resolver, /resolve_assignment_canonical_incompatibility/)
  assert.match(resolver, /audit_logs/)
  assert.match(resolver, /actual_end_date=coalesce/)
  assert.match(resolver, /Debes justificar la excepción/)
})
