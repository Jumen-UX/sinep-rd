import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('public explorer defaults to every country without silently selecting Dominican Republic', async () => {
  const [page, explorer, model, scope] = await Promise.all([
    read('src/app/(public)/page.tsx'),
    read('src/features/public/PublicDashboardExplorer.tsx'),
    read('src/features/public/usePublicDashboardModel.ts'),
    read('src/features/public/buildPublicDashboardScope.ts'),
  ])

  assert.match(page, /const initialCountry = requestedCountry[\s\S]*: ''/)
  assert.doesNotMatch(page, /const defaultCountry = initialData\.countries\.some/)
  assert.match(explorer, /const countryOptions = \[/)
  assert.match(explorer, /\{ value: '', label: 'Todos los países' \}/)
  assert.match(explorer, /label="País"/)
  assert.match(explorer, /options=\{countryOptions\}/)
  assert.match(model, /const defaultCountry = ''/)
  assert.match(model, /: 'Todos los países'/)
  assert.match(model, /dispatchHierarchy\(\{ type: 'reset_scope' \}\)/)
  assert.match(model, /setCountry: \(value: string\) => dispatchHierarchy\(\{ type: 'set_country', value \}\)/)
  assert.match(scope, /const countryDioceses = country[\s\S]*: initialData\.dioceses/)
  assert.match(scope, /if \(country\) \{/)
})
