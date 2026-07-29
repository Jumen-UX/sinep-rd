import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sitemapPath = new URL('../src/app/sitemap.ts', import.meta.url)
const robotsPath = new URL('../src/app/robots.ts', import.meta.url)
const indexingPath = new URL('../src/lib/public/indexing.ts', import.meta.url)
const envPath = new URL('../.env.example', import.meta.url)

test('public indexing is fail-closed and requires two explicit approvals', async () => {
  const [indexing, env] = await Promise.all([
    readFile(indexingPath, 'utf8'),
    readFile(envPath, 'utf8'),
  ])

  assert.match(indexing, /PUBLIC_INDEXING_ENABLED/)
  assert.match(indexing, /PUBLIC_LAUNCH_APPROVED/)
  assert.match(indexing, /isEnabled\(process\.env\.PUBLIC_INDEXING_ENABLED\)/)
  assert.match(indexing, /&& isEnabled\(process\.env\.PUBLIC_LAUNCH_APPROVED\)/)
  assert.match(env, /PUBLIC_INDEXING_ENABLED=false/)
  assert.match(env, /PUBLIC_LAUNCH_APPROVED=false/)
  assert.match(env, /Both values must be true/)
})

test('robots blocks all crawlers until the complete launch gate is enabled', async () => {
  const source = await readFile(robotsPath, 'utf8')

  assert.match(source, /if \(!isPublicIndexingEnabled\(\)\)/)
  assert.match(source, /disallow: '\/'/)
  assert.match(source, /disallow: \['\/admin\/', '\/api\/'\]/)
  assert.match(source, /sitemap: `\$\{baseUrl\}\/sitemap\.xml`/)
})

test('public sitemap exposes approved public profile domains after launch approval', async () => {
  const source = await readFile(sitemapPath, 'utf8')

  assert.match(source, /export default async function sitemap/)
  assert.match(source, /if \(!isPublicIndexingEnabled\(\)\) return \[\]/)
  assert.match(source, /function dynamicEntries/)
  assert.match(source, /person_public_directory/)
  assert.match(source, /ecclesiastical_entities/)
  assert.match(source, /ecclesiastical_places/)
  assert.match(source, /ecclesial_institutions/)
  assert.match(source, /visibility: 'eq\.public'/)
  assert.match(source, /status: 'eq\.active'/)
  assert.match(source, /dynamicEntries\(baseUrl, '\/personas', people, 0\.6\)/)
  assert.match(source, /dynamicEntries\(baseUrl, '\/entidades', entities, 0\.8\)/)
  assert.match(source, /dynamicEntries\(baseUrl, '\/lugares', places, 0\.7\)/)
  assert.match(source, /dynamicEntries\(baseUrl, '\/instituciones', institutions, 0\.7\)/)
})

test('enabled sitemap degrades to static routes when Supabase is unavailable', async () => {
  const source = await readFile(sitemapPath, 'utf8')

  assert.equal((source.match(/\.catch\(\(\) => \[\]\)/g) ?? []).length, 4)
  assert.match(source, /return \[\s*\.\.\.staticEntries,/s)
  assert.match(source, /updated_at/)
  assert.match(source, /lastModified: validDate/)
})
