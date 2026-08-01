import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [
  readme,
  docsIndex,
  adminManual,
  operationsGuide,
  sprint,
  activeSprint,
] = await Promise.all([
  readFile('README.md', 'utf8'),
  readFile('docs/README.md', 'utf8'),
  readFile('docs/manuales/manual-de-administrador.md', 'utf8'),
  readFile('docs/operations/DESPLIEGUE_MIGRACION_RESTAURACION.md', 'utf8'),
  readFile('docs/sprints/active/sprint-8.md', 'utf8'),
  readFile('docs/sprints/active/sprint-9.md', 'utf8'),
])

test('technical README links canonical operations and the dual launch gate', () => {
  assert.match(readme, /OPERACION_Y_RECUPERACION\.md/)
  assert.match(readme, /OBSERVABILITY_CONTRACT\.md/)
  assert.match(readme, /DESPLIEGUE_MIGRACION_RESTAURACION\.md/)
  assert.match(readme, /PUBLIC_INDEXING_ENABLED/)
  assert.match(readme, /PUBLIC_LAUNCH_APPROVED/)
  assert.match(readme, /Sprint 7 quedó cerrado con evidencia autenticada/)
})

test('administrator manual reflects canonical search and incident correlation', () => {
  assert.match(adminManual, /> Estado: vigente para beta interna/)
  assert.match(adminManual, /Búsqueda interna/)
  assert.match(adminManual, /personas, entidades y unidades organizativas/)
  assert.match(adminManual, /request_id/)
})

test('deployment guide separates release migration rollback restoration and indexing evidence', () => {
  for (const section of [
    '## Precondiciones',
    '## Migraciones de Supabase',
    '## Despliegue de la aplicación',
    '## Apertura a buscadores',
    '## Retroceso',
    '## Restauración',
    '## Evidencia mínima',
  ]) {
    assert.match(operationsGuide, new RegExp(section))
  }

  assert.match(operationsGuide, /pnpm audit:migrations:strict/)
  assert.match(operationsGuide, /pnpm health:check/)
  assert.match(operationsGuide, /PUBLIC_INDEXING_ENABLED=true/)
  assert.match(operationsGuide, /PUBLIC_LAUNCH_APPROVED=true/)
  assert.match(operationsGuide, /entorno aislado/)
  assert.match(operationsGuide, /pendiente operativo de beta/)
  assert.doesNotMatch(operationsGuide, /sb_secret|postgres:\/\/|SUPABASE_SERVICE_ROLE_KEY=/i)
})

test('documentation index links manuals and the deployment guide', () => {
  assert.match(docsIndex, /manuales\/README\.md/)
  assert.match(docsIndex, /DESPLIEGUE_MIGRACION_RESTAURACION\.md/)
})

test('sprint 8 is closed and Sprint 9 owns operational beta evidence', () => {
  assert.match(sprint, /> Estado: completado/)
  assert.match(sprint, /\[x\] S8-09/)
  assert.match(sprint, /\[x\] S8-10/)
  assert.match(sprint, /S8-01 a S8-10 están completados técnica y documentalmente/)
  assert.match(sprint, /Pendientes operativos de beta/)
  assert.match(sprint, /PUBLIC_LAUNCH_APPROVED/)
  assert.match(activeSprint, /> Estado: activo/)
  assert.match(activeSprint, /S9-01 — Completar S3-06/)
  assert.match(activeSprint, /No declarar restauración, validación jurídica, E2E o CI como completados sin evidencia/)
})
