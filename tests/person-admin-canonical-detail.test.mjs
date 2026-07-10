import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('admin person service augments scoped identity with canonical dimensions', async () => {
  const service = await readRepoFile('src/features/personas/services/person-admin-service.ts')

  assert.match(service, /rpc\('admin_get_person_detail'/)
  assert.match(service, /from\('person_current_clerical_state'\)/)
  assert.match(service, /from\('person_public_ordination_history'\)/)
  assert.match(service, /from\('person_public_clerical_history'\)/)
  assert.match(service, /from\('person_current_episcopal_roles'\)/)
  assert.match(service, /from\('person_current_ecclesiastical_dignities'\)/)
  assert.match(service, /effective_person_type: state\?\.effective_person_type/)
  assert.match(service, /ordination_history:/)
  assert.match(service, /clerical_history:/)
})

test('admin person detail separates sacramental canonical and assignment dimensions', async () => {
  const page = await readRepoFile('src/features/personas/admin/PersonDetailPage.tsx')

  assert.match(page, /Condición sacramental/)
  assert.match(page, /Grado más alto recibido/)
  assert.match(page, /Grados del Orden/)
  assert.match(page, /Situación canónica y pertenencia/)
  assert.match(page, /Función episcopal vigente/)
  assert.match(page, /Dignidades vigentes/)
  assert.match(page, /Los oficios y nombramientos tienen su propia vigencia e historial/)
  assert.match(page, /person\.effective_person_type \?\? person\.person_type/)
  assert.doesNotMatch(page, /personTypeLabel\(person\.person_type\)/)
})
