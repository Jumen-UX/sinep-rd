import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const auditPath = fileURLToPath(new URL('../scripts/audit-next-bundles.mjs', import.meta.url))

async function createFixture({ includePublicChunk }) {
  const root = await mkdtemp(join(tmpdir(), 'sinep-bundle-audit-'))
  const files = [
    'static/chunks/common.js',
    'static/chunks/app/(public)/page-public.js',
    'static/chunks/app/(admin)/admin/page-admin.js',
    'static/chunks/app/(admin)/admin/login/page-login.js',
  ]

  for (const file of files) {
    const absolutePath = join(root, '.next', file)
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, `console.log(${JSON.stringify(file)})`)
  }

  const loginChunks = [
    'static/chunks/common.js',
    'static/chunks/app/(admin)/admin/login/page-login.js',
  ]

  if (includePublicChunk) {
    loginChunks.push('static/chunks/app/(public)/page-public.js')
  }

  await mkdir(join(root, 'config'), { recursive: true })
  await writeFile(join(root, '.next', 'app-build-manifest.json'), JSON.stringify({
    pages: {
      '/(public)/page': [
        'static/chunks/common.js',
        'static/chunks/app/(public)/page-public.js',
      ],
      '/(admin)/admin/page': [
        'static/chunks/common.js',
        'static/chunks/app/(admin)/admin/page-admin.js',
      ],
      '/(admin)/admin/login/page': loginChunks,
    },
  }))
  await writeFile(join(root, 'config', 'web-performance-budgets.json'), JSON.stringify({
    javascript: {
      publicInitialCompressedKb: 170,
      publicDetailCompressedKb: 220,
      adminInitialCompressedKb: 300,
      singleDependencyCompressedKb: 100,
    },
    routes: ['/', '/admin'],
  }))

  return root
}

test('bundle audit rejects public route chunks from admin login', async (t) => {
  const root = await createFixture({ includePublicChunk: true })
  t.after(() => rm(root, { recursive: true, force: true }))

  const result = spawnSync(process.execPath, [auditPath], {
    cwd: root,
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stdout, /route-shell-chunk-leak/)
  assert.match(result.stdout, /app\/\(public\)\/page-public\.js/)
})

test('bundle audit accepts isolated grouped public and admin graphs', async (t) => {
  const root = await createFixture({ includePublicChunk: false })
  t.after(() => rm(root, { recursive: true, force: true }))

  const result = spawnSync(process.execPath, [auditPath], {
    cwd: root,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /"manifestKeys": \[/)
  assert.match(result.stdout, /"\/\(public\)\/page"/)
  assert.match(result.stdout, /"\/\(admin\)\/admin\/login\/page"/)
  assert.doesNotMatch(result.stdout, /route-manifest-missing/)
  assert.doesNotMatch(result.stdout, /route-shell-chunk-leak/)
})
