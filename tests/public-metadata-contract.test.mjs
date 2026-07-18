import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const helper = await readFile('src/lib/public/metadata.ts', 'utf8')
const publicLayout = await readFile('src/app/(public)/layout.tsx', 'utf8')
const home = await readFile('src/app/(public)/page.tsx', 'utf8')
const people = await readFile('src/app/(public)/personas/page.tsx', 'utf8')
const dioceses = await readFile('src/app/(public)/diocesis/page.tsx', 'utf8')
const personDetail = await readFile('src/app/(public)/personas/[slug]/layout.tsx', 'utf8')
const entityDetail = await readFile('src/app/(public)/entidades/[slug]/layout.tsx', 'utf8')

const publicPages = [home, people, dioceses, personDetail, entityDetail]

test('public metadata boundary defines one canonical site identity', () => {
  assert.match(publicLayout, /metadataBase: getPublicMetadataBase\(\)/)
  assert.match(publicLayout, /template: `%s \| \$\{PUBLIC_SITE_NAME\}`/)
  assert.match(helper, /PUBLIC_SITE_NAME = 'SINEP RD'/)
  assert.match(helper, /getAppBaseUrl/)
  assert.match(helper, /alternates: \{ canonical: canonicalPath \}/)
})

test('shared metadata builder provides Open Graph Twitter and robot semantics', () => {
  assert.match(helper, /siteName: PUBLIC_SITE_NAME/)
  assert.match(helper, /locale: 'es_DO'/)
  assert.match(helper, /twitter:/)
  assert.match(helper, /summary_large_image/)
  assert.match(helper, /robots: \{ index, follow: index \}/)
})

test('main public pages use the shared metadata builder and canonical paths', () => {
  for (const source of publicPages) assert.match(source, /buildPublicMetadata/)
  assert.match(home, /path: '\/'/)
  assert.match(people, /path: '\/personas'/)
  assert.match(dioceses, /path: '\/diocesis'/)
})

test('dynamic profiles reuse cached domain loaders and keep missing records out of indexes', () => {
  assert.match(personDetail, /loadPublicPersonDetail\(slug\)/)
  assert.match(entityDetail, /loadPublicEntityDetail\(slug\)/)
  assert.match(personDetail, /index: false/)
  assert.match(entityDetail, /index: false/)
  assert.match(personDetail, /type: 'profile'/)
  assert.match(personDetail, /image: person\.photo_url/)
})

test('page titles do not duplicate the site name before the shared template', () => {
  assert.doesNotMatch(home, /title: 'SINEP RD/)
  assert.doesNotMatch(people, /title: 'Personas · SINEP RD'/)
  assert.doesNotMatch(dioceses, /title: 'Diócesis y jurisdicciones · SINEP RD'/)
})
