import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseAccessProfiles,
  summarizeAccessProfiles,
} from '../e2e/support/access-profile-matrix.mjs'

const entityA = '11111111-1111-4111-8111-111111111111'
const entityB = '22222222-2222-4222-8222-222222222222'

function completeMatrix() {
  return [
    {
      label: 'Administrador diócesis A',
      email: 'admin-a@example.invalid',
      password: 'SECRET_ONLY_IN_CI',
      expectedState: 'ready',
      navigationRole: 'administrator',
      expectedScopeLabel: 'Diócesis A',
      expectedNavigation: {
        visible: ['/admin/nuevo', '/admin/personas'],
        hidden: [],
        readOnly: [],
      },
      ownEntityId: entityA,
      forbiddenEntityId: entityB,
      minimumVisibleDioceses: 1,
    },
    {
      label: 'Consulta diócesis B',
      email: 'viewer-b@example.invalid',
      password: 'SECRET_ONLY_IN_CI',
      expectedState: 'ready',
      navigationRole: 'viewer',
      expectedScopeLabel: 'Diócesis B',
      expectedNavigation: {
        visible: ['/admin/personas'],
        hidden: ['/admin/nuevo'],
        readOnly: ['/admin/personas'],
      },
      ownEntityId: entityB,
      forbiddenEntityId: entityA,
      minimumVisibleDioceses: 1,
    },
    {
      label: 'Onboarding pendiente',
      email: 'onboarding@example.invalid',
      password: 'SECRET_ONLY_IN_CI',
      expectedState: 'onboarding',
    },
    {
      label: 'Sin rol',
      email: 'no-role@example.invalid',
      password: 'SECRET_ONLY_IN_CI',
      expectedState: 'no_role',
    },
    {
      label: 'Bloqueado',
      email: 'blocked@example.invalid',
      password: 'SECRET_ONLY_IN_CI',
      expectedState: 'blocked',
    },
  ]
}

test('protected matrix accepts complete state navigation and bidirectional scope coverage', () => {
  const profiles = parseAccessProfiles(JSON.stringify(completeMatrix()))
  const summary = summarizeAccessProfiles(profiles)

  assert.equal(summary.total, 5)
  assert.deepEqual(summary.stateCounts, {
    ready: 2,
    onboarding: 1,
    no_role: 1,
    blocked: 1,
  })
  assert.deepEqual(summary.readyRoles, {
    administrator: 1,
    viewer: 1,
  })
})

test('protected matrix rejects conflicting navigation declarations', () => {
  const matrix = completeMatrix()
  matrix[1].expectedNavigation.hidden.push('/admin/personas')

  assert.throws(
    () => parseAccessProfiles(JSON.stringify(matrix)),
    /visible y oculta/,
  )
})

test('protected matrix rejects missing operational states', () => {
  const matrix = completeMatrix().filter((profile) => profile.expectedState !== 'blocked')

  assert.throws(
    () => parseAccessProfiles(JSON.stringify(matrix)),
    /no cubre los estados: blocked/,
  )
})

test('protected matrix rejects one-way or unrelated scope declarations', () => {
  const matrix = completeMatrix()
  matrix[1].forbiddenEntityId = '33333333-3333-4333-8333-333333333333'

  assert.throws(
    () => parseAccessProfiles(JSON.stringify(matrix)),
    /aislamiento bidireccional/,
  )
})

test('missing protected secret remains a controlled skip for push workflows', () => {
  assert.deepEqual(parseAccessProfiles(undefined), [])
})
