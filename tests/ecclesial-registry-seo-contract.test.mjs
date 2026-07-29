import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public registry profiles expose dynamic metadata and structured data', async () => {
  const [placePage, institutionPage, seo] = await Promise.all([
    readRepoFile('src/app/(public)/lugares/[slug]/page.tsx'),
    readRepoFile('src/app/(public)/instituciones/[slug]/page.tsx'),
    readRepoFile('src/lib/public/ecclesial-registry-seo.ts'),
  ])

  for (const page of [placePage, institutionPage]) {
    assert.equal(page.includes('generateMetadata'), true)
    assert.equal(page.includes('application/ld+json'), true)
    assert.equal(page.includes('serializeJsonLd'), true)
    assert.equal(page.includes("robots: { index: false, follow: false }"), true)
    assert.equal(page.includes("'use client'"), false)
  }

  assert.equal(seo.includes('alternates: { canonical }'), true)
  assert.equal(seo.includes('openGraph:'), true)
  assert.equal(seo.includes('twitter:'), true)
  assert.equal(seo.includes("'@type': isPlace ? 'PlaceOfWorship' : 'Organization'"), true)
  assert.equal(seo.includes("'@type': 'PostalAddress'"), true)
  assert.equal(seo.includes("'@type': 'GeoCoordinates'"), true)
  assert.equal(seo.includes("replace(/</g, '\\\\u003c')"), true)
  assert.equal(seo.includes('getAppBaseUrl()'), true)
})

test('sitemap includes only active public registry profiles', async () => {
  const sitemap = await readRepoFile('src/app/sitemap.ts')
  const robots = await readRepoFile('src/app/robots.ts')
  const staticRoutesDeclaration = sitemap.match(/const staticRoutes = \[(.*?)\]/s)?.[1] ?? ''

  assert.equal(sitemap.includes("fetchSupabaseJson<SitemapRecord[]>('ecclesiastical_places'"), true)
  assert.equal(sitemap.includes("fetchSupabaseJson<SitemapRecord[]>('ecclesial_institutions'"), true)
  assert.equal(sitemap.includes("status: 'eq.active'"), true)
  assert.equal(sitemap.includes("visibility: 'eq.public'"), true)
  assert.equal(sitemap.includes("dynamicEntries(baseUrl, '/lugares'"), true)
  assert.equal(sitemap.includes("dynamicEntries(baseUrl, '/instituciones'"), true)
  assert.equal(staticRoutesDeclaration.includes("'/lugares'"), false)
  assert.equal(staticRoutesDeclaration.includes("'/instituciones'"), false)

  assert.equal(robots.includes("disallow: ['/admin/', '/api/']"), true)
  assert.equal(robots.includes('isPublicIndexingEnabled()'), true)
})
