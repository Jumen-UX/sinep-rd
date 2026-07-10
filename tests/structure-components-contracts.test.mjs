import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('structure components are exported from the feature component boundary', async () => {
  const index = await readRepoFile('src/features/structures/components/index.ts')
  assert.match(index, /StructureSummary/)
  assert.match(index, /StructurePresetGrid/)
  assert.match(index, /StructureTreeList/)
})

test('structure tree exposes an accessible selectable hierarchy', async () => {
  const source = await readRepoFile('src/features/structures/components/StructureTreeList.tsx')
  assert.match(source, /role="tree"/)
  assert.match(source, /role="treeitem"/)
  assert.match(source, /aria-current/)
  assert.match(source, /onSelect\(node\)/)
  assert.match(source, /node\.depth/)
})

test('preset selector uses typed presets and does not write data directly', async () => {
  const source = await readRepoFile('src/features/structures/components/StructurePresetGrid.tsx')
  assert.match(source, /StructurePreset/)
  assert.match(source, /onApply\(preset\)/)
  assert.match(source, /preset\.levels\.map/)
  assert.doesNotMatch(source, /\.rpc\(/)
  assert.doesNotMatch(source, /\.from\(/)
})

test('summary remains presentation-only', async () => {
  const source = await readRepoFile('src/features/structures/components/StructureSummary.tsx')
  assert.match(source, /customLevelCount/)
  assert.match(source, /nodeCount/)
  assert.doesNotMatch(source, /createClient|\.rpc\(|\.from\(/)
})
