import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public dashboard shell stays neutral when the selected country changes', async () => {
  const shell = await readRepoFile('src/features/public/PublicDashboardShell.tsx')

  assert.match(shell, /<span>Cobertura internacional<\/span>/)
  assert.doesNotMatch(shell, /<span>República Dominicana<\/span>/)
  assert.doesNotMatch(shell, /['"]use client['"]/)
})
