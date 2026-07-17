import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const contractPath = new URL('../src/features/admin/dashboard/admin-kpi-contract.ts', import.meta.url)
const policyPath = new URL('../src/features/admin/dashboard/admin-kpi-policy.ts', import.meta.url)

const [contractSource, policySource] = await Promise.all([
  readFile(contractPath, 'utf8'),
  readFile(policyPath, 'utf8'),
])

test('el contrato declara las cuatro dimensiones KPI requeridas', () => {
  for (const dimension of ['territorial', 'pastoral', 'administrative', 'collegial']) {
    assert.match(contractSource, new RegExp(`dimension: '${dimension}'`))
  }
})

test('cada KPI declara permisos y alcances admitidos', () => {
  const definitions = contractSource.split(/\n\s*\{\n/).filter((chunk) => chunk.includes("id: '"))
  assert.ok(definitions.length >= 12)

  for (const definition of definitions) {
    assert.match(definition, /permissionKeys:/)
    assert.match(definition, /allowedScopeTypes:/)
  }
})

test('la política oculta KPIs sin acceso listo o sin permisos', () => {
  assert.match(policySource, /context\.accessState !== 'ready'/)
  assert.match(policySource, /!hasAnyPermission\(definition\.permissionKeys, granted\)/)
})

test('un alcance restringido nunca se trata como global', () => {
  assert.match(policySource, /if \(context\.isUnrestricted\) return 'available'/)
  assert.match(policySource, /definition\.allowedScopeTypes\.includes\(context\.activeScopeType\)/)
  assert.match(policySource, /: 'not_applicable'/)
})

test('la política conserva estados diferenciados para oculto y no aplicable', () => {
  assert.match(policySource, /'available' \| 'not_applicable' \| 'hidden'/)
  assert.match(policySource, /if \(availability === 'hidden'\) return \[\]/)
})

test('los KPI sensibles requieren permisos de lectura explícitos', () => {
  assert.match(contractSource, /id: 'administrative\.data_completeness'[\s\S]*permissionKeys: \['reports\.view'\]/)
  assert.match(contractSource, /id: 'administrative\.pending_reviews'[\s\S]*permissionKeys: \['change_requests\.view'\]/)
  assert.match(contractSource, /id: 'collegial\.current_memberships'[\s\S]*permissionKeys: \['appointments\.view'\]/)
})
