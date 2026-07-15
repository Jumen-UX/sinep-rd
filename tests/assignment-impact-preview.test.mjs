import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('assignment manager previews succession and capacity before saving', async () => {
  const page = await readRepoFile('src/features/appointments/admin/AssignmentManagerPage.tsx')
  const preview = await readRepoFile('src/features/appointments/admin/AssignmentImpactPreview.tsx')

  assert.match(page, /AssignmentImpactPreview/)
  assert.match(page, /currentScopeAssignments/)
  assert.match(page, /assignment\.is_current/)
  assert.match(page, /assignmentsToClose/)
  assert.match(page, /projectedCurrentCount/)
  assert.match(page, /exceedsCapacity/)
  assert.match(page, /setError\('La operación excedería la cantidad máxima de titulares vigentes para este cargo\.'\)/)
  assert.match(page, /predecessor_assignment_id: selectedPredecessorId \|\| null/)
  assert.match(page, /close_previous_current: selectedConfig\?\.holder_cardinality === 'multiple' && closePreviousCurrent/)

  assert.match(preview, /Vista previa del impacto/)
  assert.match(preview, /Se cerrará/)
  assert.match(preview, /Se conservará/)
  assert.match(preview, /Predecesor explícito/)
  assert.match(preview, /Titulares vigentes después de guardar/)
  assert.match(preview, /La operación excedería la cantidad máxima de titulares/)
})

test('assignment catalog exposes dates and lifecycle required by the preview', async () => {
  const service = await readRepoFile('src/features/appointments/services/assignment-admin-service.ts')

  assert.match(service, /start_date: string \| null/)
  assert.match(service, /term_end_date: string \| null/)
  assert.match(service, /actual_end_date: string \| null/)
  assert.match(service, /assignment_status: string \| null/)
  assert.match(service, /title_override,start_date,term_end_date,actual_end_date,assignment_status,is_current,record_status/)
})
