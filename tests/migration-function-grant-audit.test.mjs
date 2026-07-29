import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const auditScript = path.join(repoRoot, 'scripts', 'audit-supabase-migrations.mjs')

async function createFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'sinep-migration-audit-'))
  const migrationsRoot = path.join(root, 'supabase', 'migrations')
  await mkdir(migrationsRoot, { recursive: true })
  return { root, migrationsRoot }
}

function runAudit(root) {
  return spawnSync(process.execPath, [auditScript], {
    cwd: root,
    encoding: 'utf8',
  })
}

test('migration audit evaluates the final effective function privileges', async (t) => {
  const fixture = await createFixture()
  t.after(() => rm(fixture.root, { recursive: true, force: true }))

  await writeFile(
    path.join(fixture.migrationsRoot, '20260716190403_grant_private_helper.sql'),
    "grant execute on function app_private.example(uuid) to anon;\n",
  )

  const exposed = runAudit(fixture.root)
  assert.equal(exposed.status, 1)
  assert.match(exposed.stderr, /ejecución efectiva de app_private\.example\(uuid\) concedida a anon/)

  await writeFile(
    path.join(fixture.migrationsRoot, '20260716190404_revoke_private_helper.sql'),
    "revoke execute on function app_private.example(uuid) from public, anon;\n",
  )

  const revoked = runAudit(fixture.root)
  assert.equal(revoked.status, 0, revoked.stderr)
  assert.match(revoked.stdout, /Migraciones válidas: 2 archivo\(s\)/)

  await writeFile(
    path.join(fixture.migrationsRoot, '20260716190405_reexpose_private_helper.sql'),
    "grant all privileges on function app_private.example(uuid) to public;\n",
  )

  const reexposed = runAudit(fixture.root)
  assert.equal(reexposed.status, 1)
  assert.match(reexposed.stderr, /concedida a public/)
})
