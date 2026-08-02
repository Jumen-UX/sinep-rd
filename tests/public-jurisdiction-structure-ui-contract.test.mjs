import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('jurisdiction profiles render their public territorial structure on the server', async () => {
  const [page, loader, view] = await Promise.all([
    readRepoFile('src/app/(public)/entidades/[slug]/page.tsx'),
    readRepoFile('src/lib/public/jurisdiction-structure.ts'),
    readRepoFile('src/features/entidades/PublicJurisdictionStructure.tsx'),
  ])

  assert.equal(page.includes("'use client'"), false)
  assert.equal(page.includes('loadPublicJurisdictionStructure(data.entity.id)'), true)
  assert.equal(page.includes('PublicJurisdictionStructure nodes={structure}'), true)

  assert.equal(loader.includes("'server-only'"), true)
  assert.equal(loader.includes("'rpc/get_public_jurisdiction_structure_tree'"), true)
  assert.equal(loader.includes('unstable_cache'), true)
  assert.equal(loader.includes('PUBLIC_CACHE_TAGS.directories'), true)

  assert.equal(view.includes("'use client'"), false)
  assert.equal(view.includes('<details'), true)
  assert.equal(view.includes('<summary>'), true)
  assert.equal(view.includes('Estructura jurisdiccional'), true)
  assert.equal(view.includes('buildTree(nodes)'), true)
})
