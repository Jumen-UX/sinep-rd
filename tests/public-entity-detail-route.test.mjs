import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const adapterPath = new URL('../src/app/api/entidades/[slug]/route.ts', import.meta.url)
const pagePath = new URL('../src/features/entidades/EntityDetailPage.tsx', import.meta.url)

test('public entity detail route adapts path slug to the canonical query endpoint', async () => {
  const [adapter, page] = await Promise.all([
    readFile(adapterPath, 'utf8'),
    readFile(pagePath, 'utf8'),
  ])

  assert.match(page, /fetch\(`\/api\/entidades\/\$\{slug\}`\)/)
  assert.match(adapter, /import \{ GET as getEntityByQuery \} from '\.\.\/route'/)
  assert.match(adapter, /url\.searchParams\.set\('slug', slug\)/)
  assert.match(adapter, /return getEntityByQuery\(new NextRequest\(url/)
})
