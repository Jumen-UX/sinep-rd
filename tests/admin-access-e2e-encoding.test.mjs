import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const matrixPath = 'e2e/admin-access-matrix.spec.mjs'
const workflowPath = '.github/workflows/ci.yml'

const mojibakeMarkers = [/Ã./, /Â./, /â€”/, /â€“/, /â€™/, /â€œ/, /â€/]

function assertUtf8Text(content, source) {
  for (const marker of mojibakeMarkers) {
    assert.doesNotMatch(content, marker, `${source} contiene texto UTF-8 corrompido: ${marker}`)
  }
}

test('administrative access E2E keeps Spanish labels in valid UTF-8', async () => {
  const matrix = await readFile(matrixPath, 'utf8')

  assertUtf8Text(matrix, matrixPath)
  assert.match(matrix, /Correo electrónico/)
  assert.match(matrix, /Contraseña/)
  assert.match(matrix, /está incompleto o tiene un estado no válido/)
})

test('CI workflow metadata remains readable and the access matrix stays secret-backed', async () => {
  const workflow = await readFile(workflowPath, 'utf8')

  assertUtf8Text(workflow, workflowPath)
  assert.match(workflow, /URL pública para ejecutar Playwright y Axe/)
  assert.match(workflow, /E2E_ACCESS_PROFILES_JSON: \$\{\{ secrets\.E2E_ACCESS_PROFILES_JSON \}\}/)
  assert.match(workflow, /pnpm test:e2e:access/)
})
