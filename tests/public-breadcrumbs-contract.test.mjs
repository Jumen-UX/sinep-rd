import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public breadcrumbs remain semantic and server rendered', async () => {
  const component = await read('src/components/public/PublicBreadcrumbs.tsx')

  assert.doesNotMatch(component, /'use client'/)
  assert.match(component, /aria-label="Migas de pan"/)
  assert.match(component, /<ol/)
  assert.match(component, /aria-current=/)
  assert.match(component, /next\/link/)
})

test('public directories expose canonical parent navigation', async () => {
  const [people, dioceses] = await Promise.all([
    read('src/app/(public)/personas/page.tsx'),
    read('src/app/(public)/diocesis/page.tsx'),
  ])

  for (const source of [people, dioceses]) {
    assert.match(source, /PublicBreadcrumbs/)
    assert.match(source, /label: 'Inicio', href: '\/'/)
  }

  assert.match(people, /label: 'Personas'/)
  assert.match(dioceses, /label: 'Diócesis y jurisdicciones'/)
})

test('entity detail links back through the canonical jurisdiction directory', async () => {
  const entity = await read('src/features/entidades/EntityDetailServerView.tsx')

  assert.match(entity, /PublicBreadcrumbs/)
  assert.match(entity, /label: 'Inicio', href: '\/'/)
  assert.match(entity, /label: 'Diócesis y jurisdicciones', href: '\/diocesis'/)
  assert.match(entity, /label: entity\.name/)
  assert.match(entity, /aria-label="Ruta territorial de la entidad"/)
})
