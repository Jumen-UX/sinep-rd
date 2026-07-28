import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('the administrative registry route exports the feature page', async () => {
  const route = await read('src/app/(admin)/admin/registro-eclesial/page.tsx')
  const index = await read('src/features/ecclesial-registry/index.ts')

  assert.match(route, /EcclesialRegistryPage as default/)
  assert.match(route, /@\/features\/ecclesial-registry/)
  assert.match(index, /admin\/EcclesialRegistryPage/)
  assert.match(index, /ecclesial-registry-admin-service/)
})

test('navigation exposes the registry through scoped permissions', async () => {
  const navigation = await read('src/features/admin/navigation/admin-navigation-contract.ts')

  assert.match(navigation, /id: 'ecclesial-registry'/)
  assert.match(navigation, /href: '\/admin\/registro-eclesial'/)
  assert.match(navigation, /entryPermissions: \['places\.view', 'institutions\.view', 'communications\.view'\]/)
  assert.match(navigation, /'places\.create_proposal'/)
  assert.match(navigation, /'institutions\.create_proposal'/)
  assert.match(navigation, /'communications\.update_proposal'/)
})

test('the service uses scoped readers and audited writers', async () => {
  const service = await read('src/features/ecclesial-registry/services/ecclesial-registry-admin-service.ts')

  for (const rpc of [
    'admin_list_ecclesiastical_places',
    'admin_list_ecclesial_institutions',
    'admin_list_communication_channels',
    'admin_list_ecclesial_registry_owner_options',
    'admin_save_ecclesiastical_place',
    'admin_save_ecclesial_institution',
    'admin_save_communication_channel',
  ]) {
    assert.match(service, new RegExp(`'${rpc}'`))
  }

  assert.match(service, /p_scope_type: scope\.type/)
  assert.match(service, /p_scope_id: scope\.id/)
  assert.match(service, /owner_organization_unit_id/)
  assert.match(service, /owner_place_id/)
  assert.match(service, /owner_institution_id/)
})

test('the workspace separates places, institutions and communication channels', async () => {
  const page = await read('src/features/ecclesial-registry/admin/EcclesialRegistryPage.tsx')

  assert.match(page, /type RegistryTab = 'places' \| 'institutions' \| 'channels'/)
  assert.match(page, /Territorio, edificio, obra y canal son registros distintos/)
  assert.match(page, /Registrar templo, iglesia, santuario o capilla/)
  assert.match(page, /Registrar escuela, seminario, monasterio, dispensario o medio/)
  assert.match(page, /Agregar contacto, red, frecuencia o publicación/)
  assert.match(page, /Dedicación:/)
  assert.match(page, /Consagración:/)
  assert.match(page, /ownerKindLabel/)
})

test('the workspace derives write capability from explicit permissions', async () => {
  const page = await read('src/features/ecclesial-registry/admin/EcclesialRegistryPage.tsx')

  assert.match(page, /permissionKeys\.has\('places\.create_proposal'\)/)
  assert.match(page, /permissionKeys\.has\('institutions\.create_proposal'\)/)
  assert.match(page, /permissionKeys\.has\('communications\.update_proposal'\)/)
  assert.match(page, /permissionKeys\.has\('places\.publish'\)/)
  assert.match(page, /permissionKeys\.has\('institutions\.publish'\)/)
  assert.match(page, /canPublishPlaces \? 'active' : 'under_review'/)
  assert.match(page, /canPublishInstitutions \? 'active' : 'under_review'/)
})

test('the scoped reader migration supports all canonical scope domains', async () => {
  const migration = await read('supabase/migrations/20260728215830_add_ecclesial_registry_read_rpcs.sql')

  assert.match(migration, /v_scope_type='national'/)
  assert.match(migration, /v_scope_type in \('diocese','parish'\)/)
  assert.match(migration, /v_scope_type in \('vicariate','zone'\)/)
  assert.match(migration, /v_scope_type='organization_unit'/)
  assert.match(migration, /v_scope_type='pastoral_area'/)
  assert.match(migration, /registry_place_in_scope/)
  assert.match(migration, /registry_institution_in_scope/)
  assert.match(migration, /registry_channel_in_scope/)
})

test('public reader facades are invoker functions unavailable to anonymous clients', async () => {
  const migration = await read('supabase/migrations/20260728215830_add_ecclesial_registry_read_rpcs.sql')

  for (const name of [
    'admin_list_ecclesiastical_places',
    'admin_list_ecclesial_institutions',
    'admin_list_communication_channels',
    'admin_list_ecclesial_registry_owner_options',
  ]) {
    const start = migration.indexOf(`function public.${name}`)
    assert.notEqual(start, -1, `${name} must exist`)
    const body = migration.slice(start, migration.indexOf('create or replace function', start + name.length + 20))
    assert.match(body, /security invoker/)
    assert.doesNotMatch(body, /security definer/)
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}`))
  }
})

test('channels owned by places or institutions inherit active affiliation scope', async () => {
  const migration = await read('supabase/migrations/20260728221407_align_registry_channel_scope_with_owner_affiliations.sql')

  assert.match(migration, /owner_place_id is not null/)
  assert.match(migration, /registry_place_in_scope/)
  assert.match(migration, /registry_institution_in_scope/)
  assert.match(migration, /owner_organization_unit_id/)
  assert.match(migration, /registry_entity_in_scope/)
  assert.match(migration, /revoke all on function app_private\.registry_channel_in_scope/)
})
