import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const duplicateReviewPath = 'src/lib/admin/duplicateReview.ts'
const identityServicePath = 'src/features/personas/shared/services/person-identity-resolution-service.ts'
const canonicalServicePath = 'src/features/personas/shared/services/canonical-person-registration-service.ts'
const duplicateRoutePath = 'src/app/api/admin/duplicados/personas/route.ts'

test('person duplicate lookup remains authenticated and reusable', async () => {
  const [duplicateReview, duplicateRoute] = await Promise.all([
    readFile(duplicateReviewPath, 'utf8'),
    readFile(duplicateRoutePath, 'utf8'),
  ])

  assert.match(duplicateReview, /export async function findPotentialDuplicates/)
  assert.match(duplicateReview, /\/api\/admin\/duplicados\/personas/)
  assert.match(duplicateRoute, /requireAdminAccess/)
  assert.match(duplicateRoute, /admin_find_similar_persons/)
})

test('shared identity resolver requires an explicit reuse or create decision', async () => {
  const source = await readFile(identityServicePath, 'utf8')

  assert.match(source, /kind: 'reuse'/)
  assert.match(source, /kind: 'create_new'/)
  assert.match(source, /status: 'review_required'/)
  assert.match(source, /status: 'reuse'/)
  assert.match(source, /status: 'create_confirmed'/)
  assert.match(source, /La persona seleccionada no pertenece a las coincidencias revisadas/)
  assert.match(source, /confidenceFor/)
})

test('canonical registration can reuse a reviewed identity without creating another person', async () => {
  const source = await readFile(canonicalServicePath, 'utf8')

  assert.match(source, /inspectPersonIdentity/)
  assert.match(source, /decidePersonIdentity/)
  assert.match(source, /identity_decision/)
  assert.match(source, /resolution\.status === 'reuse'/)
  assert.match(source, /mode = 'existing'/)
  assert.match(source, /selected_person_id: selectedPersonId/)
  assert.match(source, /duplicate_review_confirmed: duplicateReviewConfirmed/)
})
