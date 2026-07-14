import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const routeFiles = [
  'src/app/(admin)/admin/asignaciones/page.tsx',
  'src/app/(admin)/admin/configuracion/cargos/page.tsx',
]

test('appointment administration routes delegate to the appointments feature', async () => {
  for (const routeFile of routeFiles) {
    const source = await readFile(routeFile, 'utf8')

    assert.match(source, /from '@\/features\/appointments'/)
    assert.doesNotMatch(source, /createClient/)
    assert.doesNotMatch(source, /\.from\s*\(/)
    assert.doesNotMatch(source, /\.rpc\s*\(/)
  }
})

test('office configuration writes use the audited RPC boundary', async () => {
  const service = await readFile(
    'src/features/appointments/services/office-configuration-admin-service.ts',
    'utf8',
  )

  assert.match(service, /admin_save_office_configuration/)
  assert.match(service, /saveOfficeConfiguration/)
})
