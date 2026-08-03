import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('pnpm keeps root overrides and the native image optimizer contract', async () => {
  const [packageJson, workspace, lockfile] = await Promise.all([
    read('package.json'),
    read('pnpm-workspace.yaml'),
    read('pnpm-lock.yaml'),
  ])

  assert.doesNotMatch(packageJson, /"pnpm"\s*:/)
  assert.match(packageJson, /"sharp"\s*:\s*"0\.35\.3"/)
  assert.match(workspace, /^overrides:\s*$/m)
  assert.match(workspace, /^\s+postcss:\s+8\.5\.19\s*$/m)
  assert.match(workspace, /^\s+sharp:\s+0\.35\.3\s*$/m)
  assert.match(workspace, /^onlyBuiltDependencies:\s*$[\s\S]*^\s+- sharp\s*$/m)
  assert.match(lockfile, /^\s+sharp@0\.35\.3:\s*$/m)
  assert.match(lockfile, /^\s+'@img\/sharp-linux-x64@0\.35\.3':\s*$/m)
  assert.match(lockfile, /^\s+'@img\/sharp-linuxmusl-x64@0\.35\.3':\s*$/m)
})

test('container build is reproducible and excludes development dependencies at runtime', async () => {
  const dockerfile = await read('Dockerfile')

  assert.match(dockerfile, /FROM base AS dependencies/)
  assert.match(dockerfile, /pnpm install --frozen-lockfile/)
  assert.doesNotMatch(dockerfile, /--no-frozen-lockfile/)
  assert.match(dockerfile, /FROM base AS runner/)
  assert.match(dockerfile, /pnpm prune --prod/)
  assert.match(dockerfile, /USER node/)
})

test('CI reuses dependency and incremental Next.js caches without caching build output', async () => {
  const workflow = await read('.github/workflows/ci.yml')

  assert.match(workflow, /cache: pnpm/)
  assert.match(workflow, /uses: actions\/cache@v(?:[4-9]|[1-9]\d+)/)
  assert.match(workflow, /path: \.next\/cache/)
  assert.match(workflow, /hashFiles\('pnpm-lock\.yaml'\)/)
  assert.match(workflow, /github\.sha/)
  assert.doesNotMatch(workflow, /path:\s*\.next\s*$/m)
})
