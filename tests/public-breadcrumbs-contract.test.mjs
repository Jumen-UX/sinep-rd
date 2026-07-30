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

test('person and registry profiles expose canonical detail breadcrumbs', async () => {
  const [person, registryProfile] = await Promise.all([
    read('src/app/(public)/personas/[slug]/page.tsx'),
    read('src/features/ecclesial-registry/public/PublicRegistryProfileView.tsx'),
  ])

  assert.match(person, /PublicBreadcrumbs/)
  assert.match(person, /label: 'Inicio', href: '\/'/)
  assert.match(person, /label: 'Personas', href: '\/personas'/)
  assert.match(person, /label: data\.person\.display_name/)

  assert.match(registryProfile, /PublicBreadcrumbs/)
  assert.match(registryProfile, /label: 'Inicio', href: '\/'/)
  assert.match(registryProfile, /label: 'Diócesis y jurisdicciones', href: '\/diocesis'/)
  assert.match(registryProfile, /primary_entity_slug/)
  assert.match(registryProfile, /href: `\/entidades\/\$\{data\.primary_entity_slug\}`/)
  assert.match(registryProfile, /target_kind === 'organization_unit'/)
  assert.match(registryProfile, /`\/pastoral\/\$\{item\.target_slug\}`/)
})

test('structural detail routes expose their public explorer hierarchy without redundant back links', async () => {
  const routes = await Promise.all([
    read('src/app/(public)/provincias-eclesiasticas/[slug]/page.tsx'),
    read('src/app/(public)/pastoral/[slug]/page.tsx'),
    read('src/app/(public)/oficinas/[id]/page.tsx'),
    read('src/app/(public)/organismos/[id]/page.tsx'),
  ])

  for (const source of routes) {
    assert.match(source, /PublicBreadcrumbs/)
    assert.match(source, /label: 'Inicio', href: '\/'/)
    assert.doesNotMatch(source, /detail-backlink|Volver al explorador/)
  }

  assert.match(routes[0], /label: 'Diócesis y jurisdicciones', href: '\/diocesis'/)
  assert.match(routes[1], /label: 'Pastoral', href: '\/\?vista=pastoral'/)
  assert.match(routes[2], /label: 'Administración', href: '\/\?vista=administrativa'/)
  assert.match(routes[3], /label: 'Organismos colegiales', href: '\/\?vista=colegial'/)
})