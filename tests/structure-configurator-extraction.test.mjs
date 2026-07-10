import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('the configurator hook orchestrates state through the shared service', async () => {
  const hook = await readRepoFile('src/features/structures/hooks/useStructureConfigurator.ts')

  for (const operation of [
    'loadStructureBaseData',
    'loadStructureTemplates',
    'loadStructureTemplateDetails',
    'loadChildLevelOptions',
  ]) {
    assert.match(hook, new RegExp(operation))
  }

  assert.doesNotMatch(hook, /\.from\(/)
  assert.doesNotMatch(hook, /\.rpc\(/)
  assert.match(hook, /changeDiocese/)
  assert.match(hook, /changeKind/)
  assert.match(hook, /refreshDetails/)
})

test('level and node editors are presentational and catalog-driven', async () => {
  const levelEditor = await readRepoFile('src/features/structures/components/StructureLevelEditor.tsx')
  const nodeEditor = await readRepoFile('src/features/structures/components/StructureNodeEditor.tsx')
  const componentIndex = await readRepoFile('src/features/structures/components/index.ts')
  const featureIndex = await readRepoFile('src/features/structures/index.ts')

  assert.match(levelEditor, /entityTypes\.map/)
  assert.match(levelEditor, /parentLevels\.map/)
  assert.match(nodeEditor, /allowedLevels\.map/)
  assert.match(nodeEditor, /entities\.map/)
  assert.match(nodeEditor, /parentNodes\.map/)

  for (const source of [levelEditor, nodeEditor]) {
    assert.doesNotMatch(source, /createClient/)
    assert.doesNotMatch(source, /\.from\(/)
    assert.doesNotMatch(source, /\.rpc\(/)
  }

  assert.match(componentIndex, /StructureLevelEditor/)
  assert.match(componentIndex, /StructureNodeEditor/)
  assert.match(featureIndex, /export \* from '\.\/components'/)
  assert.match(featureIndex, /export \* from '\.\/hooks'/)
})
