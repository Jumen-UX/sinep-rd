import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('pnpm keeps root overrides in the workspace manifest', async () => {
  const [packageJson, workspace] = await Promise.all([
    read('package.json'),
    read('pnpm-workspace.yaml'),
  ])

  assert.doesNotMatch(packageJson, /"pnpm"\s*:/)
  assert.match(workspace, /^overrides:\s*$/m)
  assert.match(workspace, /^\s+postcss:\s+8\.5\.19\s*$/m)
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
