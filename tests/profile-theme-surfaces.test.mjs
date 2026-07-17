import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function source(relativePath) {
  return readFile(new URL(relativePath, repoRoot), 'utf8')
}

const legacyColorFallback = /var\([^,]+,\s*(?:#[0-9a-f]{3,8}|rgba?\([^)]*\))\)/i

test('person history surfaces use canonical theme tokens', async () => {
  const [assignments, canonical] = await Promise.all([
    source('src/features/personas/admin/PersonAssignmentHistory.module.css'),
    source('src/features/personas/admin/PersonCanonicalTimeline.module.css'),
  ])

  assert.match(assignments, /\.card\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.match(assignments, /\.marker\s*\{[^}]*background:\s*var\(--gold\)/s)
  assert.match(assignments, /\.current\s*\{[^}]*box-shadow:\s*inset 3px 0 0 var\(--gold\)/s)
  assert.match(canonical, /\.marker\s*\{[^}]*border:\s*3px solid var\(--surface\)/s)
  assert.match(canonical, /\.category\s*\{[^}]*color:\s*var\(--text-muted\)/s)
  assert.doesNotMatch(assignments, legacyColorFallback)
  assert.doesNotMatch(canonical, legacyColorFallback)
})

test('entity relationship and institutional timelines adapt to dark mode', async () => {
  const [relationships, timeline] = await Promise.all([
    source('src/features/entidades/EntityRelationshipMap.module.css'),
    source('src/features/entidades/EntityInstitutionalTimeline.module.css'),
  ])

  assert.match(relationships, /\.node\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.match(relationships, /color-mix\(in srgb, var\(--primary\) 9%, var\(--surface\)\)/)
  assert.doesNotMatch(relationships, /color-mix\([^;]*white/i)
  assert.match(timeline, /\.content\s*\{[^}]*background:\s*var\(--surface\)/s)
  assert.match(timeline, /\.marker\s*\{[^}]*border:\s*2px solid var\(--gold\)/s)
  assert.doesNotMatch(relationships, legacyColorFallback)
  assert.doesNotMatch(timeline, legacyColorFallback)
})

test('entity profile navigation uses canonical sticky glass surface', async () => {
  const navigation = await source('src/features/entidades/EntityProfileNavigation.module.css')

  assert.match(navigation, /background:\s*color-mix\(in srgb, var\(--surface\) 92%, transparent\)/)
  assert.match(navigation, /border:\s*1px solid var\(--border\)/)
  assert.match(navigation, /box-shadow:\s*var\(--shadow-md\)/)
  assert.match(navigation, /\.link\s*\{[^}]*color:\s*var\(--foreground\)/s)
  assert.doesNotMatch(navigation, legacyColorFallback)
})
