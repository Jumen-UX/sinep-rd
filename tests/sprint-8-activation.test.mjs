import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sprint = await readFile('docs/sprints/active/sprint-8.md', 'utf8')
const operationalSprint = await readFile('docs/sprints/active/sprint-7.md', 'utf8')
const roadmap = await readFile('docs/product/ROADMAP.md', 'utf8')
const readme = await readFile('README.md', 'utf8')
const nextConfig = await readFile('next.config.ts', 'utf8')
const manifest = JSON.parse(
  await readFile('docs/DOCUMENTATION_MANIFEST.json', 'utf8'),
)

test('sprint 8 remains the active technical reference while S7-10 is operationally active', () => {
  assert.match(sprint, /> Estado: activo/)
  assert.match(sprint, /> Alcance técnico: completado/)
  assert.match(operationalSprint, /> Estado: en progreso/)
  assert.match(sprint, /S8-01 — Auditar configuración de Next\.js/)
  assert.match(sprint, /S7-10 fue reactivado/)
  assert.match(sprint, /No introducir caché sobre datos privados/)
})

test('documentation manifest points to the only active technical sprint', () => {
  assert.equal(
    manifest.canonical_documents.active_sprint,
    'docs/sprints/active/sprint-8.md',
  )
  assert.ok(manifest.metadata.allowed_statuses.includes('diferido'))
})

test('roadmap and README record sprint 8 technical completion without closing active S7-10', () => {
  assert.match(roadmap, /Sprint 8 — Rendimiento, indexación y salida mantenible/)
  assert.match(roadmap, /S7-10: reactivada y en progreso/)
  assert.match(roadmap, /Completar S7-10 con evidencia operativa autenticada/)
  assert.doesNotMatch(roadmap, /Continuar Sprint 7 desde S7-06/)

  assert.match(readme, /Sprint 8 completó su alcance técnico/)
  assert.match(readme, /S7-10 está reactivado/)
  assert.match(readme, /cierre técnico de Sprint 8/)
  assert.doesNotMatch(readme, /sprint funcional activo es Sprint 5/)
})

test('performance configuration records the justified image policy', () => {
  assert.match(nextConfig, /formats: \['image\/avif', 'image\/webp'\]/)
  assert.match(nextConfig, /hostname: '\*\*\.supabase\.co'/)
  assert.match(nextConfig, /pathname: '\/storage\/v1\/object\/\*\*'/)
  assert.match(sprint, /AVIF\/WebP/)
  assert.match(sprint, /Supabase Storage/)
  assert.match(sprint, /cualquier nueva política global seguirá requiriendo evidencia concreta/)
  assert.match(
    sprint,
    /metadata, sitemap, robots, caché, búsqueda, monitoreo y documentación/,
  )
})
