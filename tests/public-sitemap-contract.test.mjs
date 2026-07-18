import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sitemapPath = new URL('../src/app/sitemap.ts', import.meta.url)
const robotsPath = new URL('../src/app/robots.ts', import.meta.url)
const indexingPath = new URL('../src/lib/public/indexing.ts', import.meta.url)
const envPath = new URL('../.env.example', import.meta.url)

test('public indexing is disabled by default and requires an explicit flag', async () => {
  const [indexing, env] = await Promise.all([
    readFile(indexingPath, 'utf8'),
    readFile(envPath, 'utf8'),
  ])

  assert.match(indexing, /PUBLIC_INDEXING_ENABLED/)
  assert.match(indexing, /return value \? ENABLED_VALUES\.has\(value\) : false/)
  assert.match(env, /PUBLIC_INDEXING_ENABLED=false/)
  assert.match(env, /Enable only after public-launch approval/)
})

test('robots blocks all crawlers until public indexing is enabled', async () => {
  const source = await readFile(robotsPath, 'utf8')

  assert.match(source, /if \(!isPublicIndexingEnabled\(\)\)/)
  assert.match(source, /disallow: '\/'/)
  assert.match(source, /disallow: \['\/admin\/', '\/api\/'\]/)
  assert.match(source, /sitemap: `\$\{baseUrl\}\/sitemap\.xml`/)
})

test('public sitemap exposes only approved public profiles after indexing is enabled', async () => {
  const source = await readFile(sitemapPath, 'utf8')

  assert.match(source, /export default async function sitemap/)
  assert.match(source, /if \(!isPublicIndexingEnabled\(\)\) return \[\]/)
  assert.match(source, /person_public_directory/)
  assert.match(source, /ecclesiastical_entities/)
  assert.match(source, /visibility: 'eq\.public'/)
  assert.match(source, /status: 'eq\.active'/)
  assert.match(source, /\/personas\/\$\{encodeURIComponent\(person\.slug\)\}/)
  assert.match(source, /\/entidades\/\$\{encodeURIComponent\(entity\.slug\)\}/)
})

test('enabled sitemap degrades to static routes when Supabase is unavailable', async () => {
  const source = await readFile(sitemapPath, 'utf8')

  assert.equal((source.match(/\.catch\(\(\) => \[\]\)/g) ?? []).length, 2)
  assert.match(source, /return \[\.\.\.staticEntries, \.\.\.entityEntries, \.\.\.personEntries\]/)
  assert.match(source, /updated_at/)
  assert.match(source, /lastModified: validDate/)
})
