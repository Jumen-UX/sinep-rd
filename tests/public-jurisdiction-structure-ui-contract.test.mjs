import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('jurisdiction profiles render their current public account hierarchy on the server', async () => {
  const [page, loader, view, migration] = await Promise.all([
    readRepoFile('src/app/(public)/entidades/[slug]/page.tsx'),
    readRepoFile('src/lib/public/jurisdiction-structure.ts'),
    readRepoFile('src/features/entidades/PublicJurisdictionStructure.tsx'),
    readRepoFile('supabase/migrations/20260805133000_create_jurisdiction_account_plan.sql'),
  ])

  assert.equal(page.includes("'use client'"), false)
  assert.equal(page.includes('loadPublicJurisdictionStructure(data.entity.id)'), true)
  assert.equal(page.includes('PublicJurisdictionStructure nodes={structure}'), true)

  assert.equal(loader.includes("'server-only'"), true)
  assert.equal(loader.includes("'public_jurisdiction_account_tree'"), true)
  assert.equal(loader.includes('ecclesiastical_entity_id: `eq.${normalizedId}`'), true)
  assert.equal(loader.includes('path_ids: `cs.{${rootAccountId}}`'), true)
  assert.equal(loader.includes('public_jurisdiction_structure_tree'), false)
  assert.equal(loader.includes('unstable_cache'), true)
  assert.equal(loader.includes('PUBLIC_CACHE_TAGS.directories'), true)

  assert.match(migration, /create or replace view public\.public_jurisdiction_account_tree/i)
  assert.match(migration, /security_invoker=true/i)
  assert.match(migration, /grant select on public\.public_jurisdiction_account_tree to anon,authenticated/i)
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete)\s+on\s+public\.public_jurisdiction_account_tree/i)

  assert.equal(view.includes("'use client'"), false)
  assert.equal(view.includes('<details'), true)
  assert.equal(view.includes('<summary>'), true)
  assert.equal(view.includes('Relaciones jurisdiccionales vigentes'), true)
  assert.equal(view.includes('buildTree(nodes)'), true)
  assert.equal(view.includes('node.account_id'), true)
  assert.equal(view.includes('node.account_type_name'), true)
})
