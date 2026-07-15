import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('documentation integrity is part of affected and complete checks', async () => {
  const packageJson = JSON.parse(await readRepoFile('package.json'))

  assert.equal(packageJson.scripts['docs:check'], 'node scripts/check-documentation.mjs')
  assert.equal(packageJson.scripts['docs:index'], 'node scripts/generate-documentation-index.mjs')
  assert.match(packageJson.scripts['check:affected'], /pnpm docs:check/)
  assert.match(packageJson.scripts.check, /pnpm docs:check/)
})

test('documentation checker protects canonical paths links tests and active sprint state', async () => {
  const checker = await readRepoFile('scripts/check-documentation.mjs')
  const manifest = JSON.parse(await readRepoFile('docs/DOCUMENTATION_MANIFEST.json'))

  assert.equal(manifest.canonical_documents.active_sprint, 'docs/sprints/active/sprint-4.md')
  assert.equal(manifest.policies.strict_internal_links, true)
  assert.equal(manifest.policies.strict_test_document_paths, true)
  assert.equal(manifest.policies.single_active_sprint, true)
  assert.match(checker, /Enlace interno roto/)
  assert.match(checker, /Prueba con ruta documental inexistente/)
  assert.match(checker, /Debe existir exactamente un sprint activo/)
  assert.match(checker, /Posibles documentos duplicados/)
  assert.match(checker, /Documento posiblemente huérfano/)
})

test('documentation index is generated from the current repository inventory', async () => {
  const generator = await readRepoFile('scripts/generate-documentation-index.mjs')

  assert.match(generator, /INDEX\.generated\.md/)
  assert.match(generator, /No editar manualmente/)
  assert.match(generator, /--check/)
  assert.match(generator, /El índice documental está desactualizado/)
})
