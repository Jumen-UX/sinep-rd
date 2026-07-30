import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('selective print and export controls remain explicit accessible and reversible', async () => {
  const [control, moduleStyles, printStyles, publicLayout] = await Promise.all([
    read('src/components/public/PublicProfilePrintControls.tsx'),
    read('src/components/public/PublicProfilePrintControls.module.css'),
    read('src/app/public-profile-print.css'),
    read('src/app/(public)/layout.tsx'),
  ])

  assert.match(control, /^['"]use client['"]/)
  assert.match(control, /<fieldset/)
  assert.match(control, /<legend className="sr-only">Secciones de la ficha<\/legend>/)
  assert.match(control, /type="checkbox"/)
  assert.match(control, /disabled=\{selectionDisabled\}/)
  assert.match(control, /document\.querySelector<HTMLElement>\('\[data-print-profile\]'\)/)
  assert.match(control, /querySelectorAll<HTMLElement>\('\[data-print-section\]'\)/)
  assert.match(control, /window\.addEventListener\('afterprint', cleanup\)/)
  assert.match(control, /removeAttribute\('data-print-hidden'\)/)
  assert.match(control, /window\.print\(\)/)
  assert.match(control, /schema: 'sinep\.public-profile-export'/)
  assert.match(control, /schemaVersion: 1/)
  assert.match(control, /Object\.hasOwn\(exportData, section\.id\)/)
  assert.match(control, /new Blob/)
  assert.match(control, /application\/json;charset=utf-8/)
  assert.match(control, /URL\.createObjectURL/)
  assert.match(control, /URL\.revokeObjectURL/)
  assert.match(control, /download\.download = exportFileName/)
  assert.match(control, /role="status"/)
  assert.doesNotMatch(control, /dangerouslySetInnerHTML|document\.write|innerHTML/)

  assert.doesNotMatch(moduleStyles, /:global|@media print/)
  assert.match(moduleStyles, /\.actions/)
  assert.match(moduleStyles, /\.status/)
  assert.match(publicLayout, /import '\.\.\/public-profile-print\.css'/)
  assert.match(printStyles, /@media print/)
  assert.match(printStyles, /\[data-print-hidden\]/)
  assert.match(printStyles, /display: none !important/)
  assert.match(printStyles, /break-inside: avoid/)
})

test('entity profile exposes only available canonical sections to selective printing and export', async () => {
  const entity = await read('src/features/entidades/EntityDetailServerView.tsx')

  assert.match(entity, /PublicProfilePrintControls/)
  assert.match(entity, /data-print-profile/)
  assert.match(entity, /\{ id: 'resumen', label: 'Resumen e indicadores' \}/)
  assert.match(entity, /currentOrdinary \? \[\{ id: 'autoridad'/)
  assert.match(entity, /statisticsSnapshots\.length > 0 \? \[\{ id: 'estadisticas'/)
  assert.match(entity, /positions\.length > 0 \? \[\{ id: 'organigrama'/)
  assert.match(entity, /const exportData = \{/)
  assert.match(entity, /exportData=\{exportData\}/)
  assert.match(entity, /exportFileName=\{`entidad-\$\{entity\.slug\}\.json`\}/)
  assert.match(entity, /exportProfileType="ecclesiastical_entity"/)
  assert.doesNotMatch(entity, /notes: relationship\.notes/)

  for (const section of ['resumen', 'datos', 'autoridad', 'jerarquia', 'historia', 'estadisticas', 'organigrama']) {
    assert.match(entity, new RegExp(`data-print-section="${section}"`))
  }
})

test('place and institution profiles expose data-aware print sections', async () => {
  const registry = await read('src/features/ecclesial-registry/public/PublicRegistryProfileView.tsx')

  assert.match(registry, /PublicProfilePrintControls/)
  assert.match(registry, /data-print-profile/)
  assert.match(registry, /\{ id: 'encabezado', label: 'Encabezado y descripción' \}/)
  assert.match(registry, /\{ id: 'informacion', label: 'Información principal' \}/)
  assert.match(registry, /\{ id: 'relaciones', label: 'Relaciones vigentes' \}/)
  assert.match(registry, /history\.length > 0 \? \[\{ id: 'historial'/)
  assert.match(registry, /data\.channels\.length > 0 \? \[\{ id: 'contacto'/)
  assert.match(registry, /record\.source_name \|\| record\.source_checked_at/)

  for (const section of ['encabezado', 'informacion', 'relaciones', 'historial', 'contacto', 'fuente']) {
    assert.match(registry, new RegExp(`data-print-section="${section}"`))
  }
})

test('person profiles expose canonical and data-aware print groups', async () => {
  const person = await read('src/features/personas/PersonDetailServerView.tsx')

  assert.match(person, /PublicProfilePrintControls/)
  assert.match(person, /data-print-profile/)
  assert.match(person, /\{ id: 'resumen', label: 'Resumen e indicadores' \}/)
  assert.match(person, /\{ id: 'identidad', label: 'Identidad y situación canónica' \}/)
  assert.match(person, /\{ id: 'ordenaciones', label: 'Historia sacramental' \}/)
  assert.match(person, /hasEpiscopalData \? \[\{ id: 'episcopado'/)
  assert.match(person, /hasCanonicalHistory \? \[\{ id: 'historia'/)
  assert.match(person, /movements\.length > 0 \? \[\{ id: 'movimientos'/)

  for (const section of ['resumen', 'identidad', 'ordenaciones', 'episcopado', 'cargos', 'historia', 'movimientos']) {
    assert.match(person, new RegExp(`data-print-section="${section}"`))
  }
})
