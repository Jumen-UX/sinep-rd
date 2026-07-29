import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const readRepoFile = (path) => readFile(new URL(path, repoRoot), 'utf8')

const removedDetailEndpoints = [
  'src/app/api/entidades/[slug]/route.ts',
  'src/app/api/organizacion/route.ts',
  'src/app/api/pastoral/route.ts',
  'src/app/api/provincias-eclesiasticas/route.ts',
]

test('server-rendered public details do not keep duplicate API endpoints without consumers', async () => {
  for (const path of removedDetailEndpoints) {
    await assert.rejects(access(new URL(path, repoRoot)))
  }

  const [cache, organization, pastoral, province] = await Promise.all([
    readRepoFile('src/lib/public/cache.ts'),
    readRepoFile('src/lib/public/organization-detail.ts'),
    readRepoFile('src/lib/public/organization-unit-detail.ts'),
    readRepoFile('src/lib/public/ecclesiastical-province-detail.ts'),
  ])

  assert.match(cache, /loadPublicOrganizationDetail/)
  assert.match(cache, /loadPublicOrganizationUnitDetail/)
  assert.match(cache, /loadPublicEcclesiasticalProvinceDetail/)
  assert.match(organization, /organization_units/)
  assert.match(pastoral, /public_organization_units/)
  assert.match(province, /public_dioceses/)
})
