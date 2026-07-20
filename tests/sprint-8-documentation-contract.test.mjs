import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [
  readme,
  docsIndex,
  adminManual,
  operationsGuide,
] = await Promise.all([
  readFile('README.md', 'utf8'),
  readFile('docs/README.md', 'utf8'),
  readFile('docs/manuales/manual-de-administrador.md', 'utf8'),
  readFile('docs/operations/DESPLIEGUE_MIGRACION_RESTAURACION.md', 'utf8'),
])

test('technical README links the canonical operational documentation', () => {
  assert.match(readme, /OPERACION_Y_RECUPERACION\.md/)
  assert.match(readme, /OBSERVABILITY_CONTRACT\.md/)
  assert.match(readme, /DESPLIEGUE_MIGRACION_RESTAURACION\.md/)
  assert.match(readme, /PUBLIC_INDEXING_ENABLED/)
})

test('administrator manual reflects canonical search and incident correlation', () => {
  assert.match(adminManual, /> Estado: vigente para beta interna/)
  assert.match(adminManual, /Búsqueda interna/)
  assert.match(adminManual, /personas, entidades y unidades organizativas/)
  assert.match(adminManual, /request_id/)
})

test('deployment guide separates release migration rollback and restoration evidence', () => {
  for (const section of [
    '## Precondiciones',
    '## Migraciones de Supabase',
    '## Despliegue de la aplicación',
    '## Retroceso',
    '## Restauración',
    '## Evidencia mínima',
  ]) {
    assert.match(operationsGuide, new RegExp(section))
  }

  assert.match(operationsGuide, /pnpm audit:migrations:strict/)
  assert.match(operationsGuide, /pnpm health:check/)
  assert.match(operationsGuide, /entorno aislado/)
  assert.match(operationsGuide, /pendiente operativo de beta/)
  assert.doesNotMatch(operationsGuide, /sb_secret|postgres:\/\/|SUPABASE_SERVICE_ROLE_KEY=/i)
})

test('documentation index links manuals and the deployment guide', () => {
  assert.match(docsIndex, /manuales\/README\.md/)
  assert.match(docsIndex, /DESPLIEGUE_MIGRACION_RESTAURACION\.md/)
})

