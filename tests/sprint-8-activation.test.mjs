import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sprint = await readFile('docs/sprints/active/sprint-8.md', 'utf8')
const deferredSprint = await readFile('docs/sprints/active/sprint-7.md', 'utf8')
const roadmap = await readFile('docs/product/ROADMAP.md', 'utf8')
const readme = await readFile('README.md', 'utf8')
const nextConfig = await readFile('next.config.ts', 'utf8')
const manifest = JSON.parse(
  await readFile('docs/DOCUMENTATION_MANIFEST.json', 'utf8'),
)

test('sprint 8 is the active non-operational workstream', () => {
  assert.match(sprint, /> Estado: activo/)
  assert.match(deferredSprint, /> Estado: diferido/)
  assert.match(sprint, /S8-01 — Auditar configuración de Next\.js/)
  assert.match(sprint, /S7-10 permanece diferido/)
  assert.match(sprint, /No introducir caché sobre datos privados/)
})

test('documentation manifest points to the only active sprint', () => {
  assert.equal(
    manifest.canonical_documents.active_sprint,
    'docs/sprints/active/sprint-8.md',
  )
  assert.ok(manifest.metadata.allowed_statuses.includes('diferido'))
})

test('roadmap and README point to sprint 8 without closing deferred S7-10', () => {
  assert.match(roadmap, /Sprint 8 — Rendimiento, indexación y salida mantenible/)
  assert.match(roadmap, /S7-10: diferida/)
  assert.match(roadmap, /Mantener S7-10 diferido hasta nueva instrucción/)
  assert.doesNotMatch(roadmap, /Continuar Sprint 7 desde S7-06/)

  assert.match(readme, /El frente técnico activo es Sprint 8/)
  assert.match(readme, /S7-10 permanece diferido/)
  assert.match(readme, /Sprint 8 activo/)
  assert.doesNotMatch(readme, /sprint funcional activo es Sprint 5/)
})

test('initial performance inventory keeps Next.js configuration intentionally minimal', () => {
  assert.match(nextConfig, /const nextConfig: NextConfig = \{\}/)
  assert.match(sprint, /`next\.config\.ts` no declara todavía políticas globales de rendimiento/)
  assert.match(sprint, /no se modificará sin evidencia concreta/)
  assert.match(
    sprint,
    /metadata, sitemap, robots, caché, búsqueda, monitoreo y documentación/,
  )
})
