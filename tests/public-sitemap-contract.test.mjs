import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sitemapPath = new URL('../src/app/sitemap.ts', import.meta.url)

test('public sitemap includes dynamic person and entity profiles', async () => {
  const source = await readFile(sitemapPath, 'utf8')

  assert.match(source, /export default async function sitemap/)
  assert.match(source, /person_public_directory/)
  assert.match(source, /ecclesiastical_entities/)
  assert.match(source, /visibility: 'eq\.public'/)
  assert.match(source, /status: 'eq\.active'/)
  assert.match(source, /\/personas\/\$\{encodeURIComponent\(person\.slug\)\}/)
  assert.match(source, /\/entidades\/\$\{encodeURIComponent\(entity\.slug\)\}/)
})

test('public sitemap degrades to static routes when Supabase is unavailable', async () => {
  const source = await readFile(sitemapPath, 'utf8')

  assert.equal((source.match(/\.catch\(\(\) => \[\]\)/g) ?? []).length, 2)
  assert.match(source, /return \[\.\.\.staticEntries, \.\.\.entityEntries, \.\.\.personEntries\]/)
  assert.match(source, /updated_at/)
  assert.match(source, /lastModified: validDate/)
})
