import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const matrixPath = 'e2e/admin-access-matrix.spec.mjs'
const validatorPath = 'e2e/support/access-profile-matrix.mjs'
const workflowPath = '.github/workflows/ci.yml'

const mojibakeMarkers = [/Ã./, /Â./, /â€”/, /â€“/, /â€™/, /â€œ/, /â€/]

function assertUtf8Text(content, source) {
  for (const marker of mojibakeMarkers) {
    assert.doesNotMatch(content, marker, `${source} contiene texto UTF-8 corrompido: ${marker}`)
  }
}

test('administrative access E2E keeps Spanish labels in valid UTF-8', async () => {
  const [matrix, validator] = await Promise.all([
    readFile(matrixPath, 'utf8'),
    readFile(validatorPath, 'utf8'),
  ])

  assertUtf8Text(matrix, matrixPath)
  assertUtf8Text(validator, validatorPath)
  assert.match(matrix, /Correo electrónico/)
  assert.match(matrix, /Contraseña/)
  assert.match(matrix, /no debe ver la entidad prohibida/)
  assert.match(validator, /tiene un estado no válido/)
  assert.match(validator, /aislamiento bidireccional/)
})

test('CI workflow metadata remains readable and the access matrix stays secret-backed', async () => {
  const workflow = await readFile(workflowPath, 'utf8')

  assertUtf8Text(workflow, workflowPath)
  assert.match(workflow, /URL pública para ejecutar Playwright y Axe/)
  assert.match(workflow, /E2E_ACCESS_PROFILES_JSON: \$\{\{ secrets\.E2E_ACCESS_PROFILES_JSON \}\}/)
  assert.match(workflow, /pnpm test:e2e:access/)
})
