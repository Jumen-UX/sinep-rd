import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sprint = await readFile('docs/sprints/active/sprint-8.md', 'utf8')
const activeSprint = await readFile('docs/sprints/active/sprint-9.md', 'utf8')
const operationalSprint = await readFile('docs/sprints/active/sprint-7.md', 'utf8')
const evidence = await readFile('docs/sprints/active/sprint-7-s7-10-evidence.md', 'utf8')
const riskAcceptance = await readFile('docs/security/RISK_ACCEPTANCE_LEAKED_PASSWORD_PROTECTION.md', 'utf8')
const roadmap = await readFile('docs/product/ROADMAP.md', 'utf8')
const readme = await readFile('README.md', 'utf8')
const nextConfig = await readFile('next.config.ts', 'utf8')
const manifest = JSON.parse(
  await readFile('docs/DOCUMENTATION_MANIFEST.json', 'utf8'),
)

test('sprints 7 and 8 are closed and sprint 9 owns beta readiness', () => {
  assert.match(sprint, /> Estado: completado/)
  assert.match(activeSprint, /> Estado: activo/)
  assert.match(activeSprint, /S9-01 — Completar S3-06/)
  assert.match(sprint, /> Alcance técnico: completado/)
  assert.match(operationalSprint, /> Estado: completado/)
  assert.match(evidence, /> Estado: completado/)
  assert.match(sprint, /S8-01 — Auditoría de Next\.js/)
  assert.match(sprint, /Sprint 7, incluida S7-10, quedó completado/)
  assert.match(sprint, /No formar parte del cierre técnico de Sprint 8|No forman parte del cierre técnico de Sprint 8/)
  assert.match(sprint, /Ningún dato privado o dependiente del alcance puede usar caché pública/)
})

test('documentation manifest points to Sprint 9', () => {
  assert.equal(
    manifest.canonical_documents.active_sprint,
    'docs/sprints/active/sprint-9.md',
  )
  assert.ok(manifest.metadata.allowed_statuses.includes('diferido'))
})

test('roadmap and README record sprint 7 closure and public-launch preparation', () => {
  assert.match(roadmap, /Los Sprints 0–7 están cerrados técnica y operativamente/)
  assert.match(roadmap, /Sprint 9 está activo para preparar la beta operativa/)
  assert.match(roadmap, /RISK_ACCEPTANCE_LEAKED_PASSWORD_PROTECTION\.md/)
  assert.doesNotMatch(roadmap, /S7-10: reactivada y en progreso/)

  assert.match(readme, /Sprints 7 y 8 están cerrados/)
  assert.match(readme, /Sprint 9 está activo para completar la preparación operativa de una beta controlada/)
  assert.match(readme, /RISK_ACCEPTANCE_LEAKED_PASSWORD_PROTECTION\.md/)
  assert.doesNotMatch(readme, /S7-10 está reactivado/)
})

test('temporary leaked-password risk acceptance has owner controls and deadline', () => {
  assert.match(riskAcceptance, /> Estado: aceptado temporalmente/)
  assert.match(riskAcceptance, /> Fecha máxima de revisión: 2026-10-29/)
  assert.match(riskAcceptance, /> Responsable: propietario del proyecto SINEP RD/)
  assert.match(riskAcceptance, /antes de cualquier apertura pública/)
  assert.match(riskAcceptance, /Suspender las cuentas QA y retirar sus roles/)
  assert.match(riskAcceptance, /Eliminar `E2E_ACCESS_PROFILES_JSON`/)
})

test('performance configuration records the justified image policy', () => {
  assert.match(nextConfig, /formats: \['image\/avif', 'image\/webp'\]/)
  assert.match(nextConfig, /hostname: '\*\*\.supabase\.co'/)
  assert.match(nextConfig, /pathname: '\/storage\/v1\/object\/\*\*'/)
  assert.match(sprint, /AVIF\/WebP/)
  assert.match(sprint, /Supabase Storage/)
  assert.match(sprint, /cualquier nueva política global seguirá requiriendo evidencia concreta|orígenes remotos autorizados/)
  assert.match(
    sprint,
    /metadata, sitemap, robots, caché, búsqueda, monitoreo y documentación/,
  )
})
