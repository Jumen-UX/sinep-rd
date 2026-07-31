import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, repoRoot), 'utf8')

test('diocese directory preserves country scope across SSR API and explorer links', async () => {
  const [directory, page, api, territorial] = await Promise.all([
    read('src/lib/public/directories.ts'),
    read('src/app/(public)/diocesis/page.tsx'),
    read('src/app/api/diocesis/route.ts'),
    read('src/features/public/PublicTerritorialView.tsx'),
  ])

  assert.match(directory, /country_iso2: string \| null/)
  assert.match(directory, /country_name: string \| null/)
  assert.match(directory, /'country_iso2','country_name'/)
  assert.match(directory, /if \(countryIso2\) params\.country_iso2 = `eq\.\$\{countryIso2\.toUpperCase\(\)\}`/)

  assert.match(api, /searchParams\.get\('pais'\)/)
  assert.match(api, /loadDioceseDirectory\(tipo, provincia, limit, pais\)/)

  assert.match(page, /const country = firstValue\(params\.pais\)\?\.toUpperCase\(\) \?\? null/)
  assert.match(page, /loadDioceseDirectory\('all', null, undefined, country\)/)
  assert.match(page, /countryName = country/)
  assert.match(page, /item\.country_name \?\? item\.country_iso2 \?\? 'País no indicado'/)
  assert.match(page, /Selecciona un país en el explorador/)
  assert.doesNotMatch(page, /<span>República Dominicana<\/span>/)
  assert.doesNotMatch(page, /\?\? 'República Dominicana'/)

  assert.match(territorial, /directoryParams\.set\('pais', country\)/)
  assert.match(territorial, /directoryParams\.set\('provincia', province\)/)
  assert.match(territorial, /href=\{directoryHref\}/)
})
