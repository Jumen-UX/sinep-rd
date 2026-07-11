import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('admin shell exposes canonical incompatibility queue and counter', async () => {
  const shell = await read('src/app/(admin)/admin/AdminShell.tsx')

  assert.match(shell, /admin_list_assignment_canonical_incompatibilities/)
  assert.match(shell, /p_status: 'open'/)
  assert.match(shell, /\/admin\/incompatibilidades-canonicas/)
  assert.match(shell, /Nombramientos incompatibles con las reglas vigentes/)
  assert.match(shell, /Abrir bandeja/)
})

test('canonical counter is not shown on login', async () => {
  const shell = await read('src/app/(admin)/admin/AdminShell.tsx')

  assert.match(shell, /if \(pathname === '\/admin\/login'\) return/)
  assert.match(shell, /pathname === '\/admin' && canonicalIncompatibilities/)
})
