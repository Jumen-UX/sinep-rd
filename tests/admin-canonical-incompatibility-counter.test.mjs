import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('canonical incompatibility service owns the queue query and counter contract', async () => {
  const [service, shell] = await Promise.all([
    read('src/features/appointments/services/canonical-incompatibility-queue.ts'),
    read('src/app/(admin)/admin/AdminShell.tsx'),
  ])

  assert.match(service, /admin_list_assignment_canonical_incompatibilities/)
  assert.match(service, /p_status: 'open'/)
  assert.match(service, /p_limit: 1/)
  assert.match(service, /typeof queue\?\.total === 'number'/)
  assert.match(shell, /loadCanonicalIncompatibilityCount/)
  assert.doesNotMatch(shell, /supabase\.rpc\(/)
  assert.match(shell, /\/admin\/incompatibilidades-canonicas/)
  assert.match(shell, /Nombramientos incompatibles con las reglas vigentes/)
  assert.match(shell, /Abrir bandeja/)
})

test('canonical counter is not shown on login', async () => {
  const shell = await read('src/app/(admin)/admin/AdminShell.tsx')

  assert.match(shell, /if \(pathname === '\/admin\/login'\) return/)
  assert.match(shell, /pathname === '\/admin' && canonicalIncompatibilities/)
})
