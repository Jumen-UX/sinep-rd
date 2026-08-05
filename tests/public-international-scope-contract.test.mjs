import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public product language supports international jurisdiction discovery without forcing a rebrand', async () => {
  const [metadata, page, intro, publicLayout] = await Promise.all([
    read('src/lib/public/metadata.ts'),
    read('src/app/(public)/page.tsx'),
    read('src/features/public/PublicLandingIntro.tsx'),
    read('src/app/(public)/layout.tsx'),
  ])

  assert.match(page, /Plan de jurisdicciones eclesiales/)
  assert.match(page, /Iglesia católica desde la Santa Sede/)
  assert.match(intro, /Santa Sede/)
  assert.match(intro, /Buscar por país/)
  assert.doesNotMatch(page, /exclusivamente|solo en República Dominicana/)
  assert.doesNotMatch(intro, /servicio pastoral|personas|organismos colegiales/i)
  assert.doesNotMatch(metadata, /Sistema Nacional/)
  assert.doesNotMatch(publicLayout, /Sistema Nacional/)
  assert.match(metadata, /PUBLIC_SITE_NAME = 'SINEP RD'/)
  assert.match(publicLayout, /<strong>SINEP RD<\/strong>/)
})
