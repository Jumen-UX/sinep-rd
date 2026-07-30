import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public product language supports multiple countries without forcing a rebrand', async () => {
  const [metadata, landing, publicLayout] = await Promise.all([
    read('src/lib/public/metadata.ts'),
    read('src/app/(public)/page.tsx'),
    read('src/app/(public)/layout.tsx'),
  ])

  assert.match(metadata, /distintos países/)
  assert.match(landing, /Iglesia en distintos países/)
  assert.match(publicLayout, /Información eclesial y pastoral/)
  assert.match(publicLayout, /Plataforma de información eclesiástica y pastoral/)

  assert.doesNotMatch(metadata, /Sistema Nacional/)
  assert.doesNotMatch(landing, /exclusivamente|solo en República Dominicana/)
  assert.doesNotMatch(publicLayout, /Sistema Nacional/)

  assert.match(metadata, /PUBLIC_SITE_NAME = 'SINEP RD'/)
  assert.match(publicLayout, /<strong>SINEP RD<\/strong>/)
})
