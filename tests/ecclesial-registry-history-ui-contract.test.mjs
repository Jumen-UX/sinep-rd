import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrations = {
  preserve: '20260728223626_preserve_registry_primary_affiliation_history.sql',
  readers: '20260728223724_add_registry_edit_history_readers.sql',
  close: '20260728223811_add_registry_affiliation_close_rpcs.sql',
}

async function read(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`)
  assert.notEqual(start, -1, `${name} must exist`)
  const end = source.indexOf('create or replace function', start + name.length + 20)
  return source.slice(start, end === -1 ? source.length : end)
}

test('repository versions the registry edit and history migrations', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))
  for (const fileName of Object.values(migrations)) {
    assert.equal(files.includes(fileName), true, `${fileName} must be committed`)
  }
})

test('primary affiliation transitions are historical instead of in-place rewrites', async () => {
  const migration = await read(`supabase/migrations/${migrations.preserve}`)

  assert.match(migration, /ecclesiastical_place_affiliations_one_current_primary_idx/)
  assert.match(migration, /ecclesial_institution_affiliations_one_current_primary_idx/)
  assert.match(migration, /valid_to = current_date/)
  assert.match(migration, /is_current = false/)
  assert.match(migration, /status = 'inactive'/)
  assert.match(migration, /'transition', 'primary_closed'/)
  assert.match(migration, /'transition', 'primary_created'/)
  assert.match(migration, /sync_ecclesiastical_place_primary_affiliation_history/)
  assert.match(migration, /sync_ecclesial_institution_primary_affiliation_history/)
})

test('consistency triggers protect the current primary relationship', async () => {
  const migration = await read(`supabase/migrations/${migrations.preserve}`)

  assert.match(migration, /enforce_place_primary_affiliation_consistency/)
  assert.match(migration, /enforce_institution_primary_affiliation_consistency/)
  assert.match(migration, /La afiliación primaria no puede cerrarse directamente/)
  assert.match(migration, /before insert or update on public\.ecclesiastical_place_affiliations/)
  assert.match(migration, /before insert or update on public\.ecclesial_institution_affiliations/)
})

test('detail and history readers are scoped invoker facades', async () => {
  const migration = await read(`supabase/migrations/${migrations.readers}`)

  for (const name of [
    'public.admin_get_ecclesiastical_place',
    'public.admin_get_ecclesial_institution',
    'public.admin_list_ecclesiastical_place_affiliations',
    'public.admin_list_ecclesial_institution_affiliations',
  ]) {
    const body = functionBody(migration, name)
    assert.match(body, /security invoker/)
    assert.doesNotMatch(body, /security definer/)
  }

  assert.match(migration, /current_user_can_manage_ecclesiastical_place\('places\.view'/)
  assert.match(migration, /current_user_can_manage_ecclesial_institution\('institutions\.view'/)
  assert.match(migration, /is_primary_relation boolean/)
  assert.match(migration, /revoke all on function public\.admin_get_ecclesiastical_place\(uuid\) from public, anon/)
})

test('close operations reject primary relations and preserve secondary history', async () => {
  const migration = await read(`supabase/migrations/${migrations.close}`)

  assert.match(migration, /admin_close_ecclesiastical_place_affiliation/)
  assert.match(migration, /admin_close_ecclesial_institution_affiliation/)
  assert.match(migration, /La afiliación primaria se modifica desde la ficha del lugar/)
  assert.match(migration, /La afiliación primaria se modifica desde la ficha de la institución/)
  assert.match(migration, /valid_to = v_valid_to/)
  assert.match(migration, /is_current = false/)
  assert.match(migration, /'transition', 'closed'/)
  assert.match(functionBody(migration, 'public.admin_close_ecclesiastical_place_affiliation'), /security invoker/)
  assert.match(functionBody(migration, 'public.admin_close_ecclesial_institution_affiliation'), /security invoker/)
})

test('the specialized route and navigation expose edit history by scoped permissions', async () => {
  const route = await read('src/app/(admin)/admin/relaciones-eclesiales/page.tsx')
  const index = await read('src/features/ecclesial-registry/index.ts')
  const navigation = await read('src/features/admin/navigation/admin-navigation-contract.ts')

  assert.match(route, /EcclesialRegistryHistoryPage as default/)
  assert.match(index, /EcclesialRegistryHistoryPage/)
  assert.match(index, /ecclesial-registry-history-service/)
  assert.match(navigation, /id: 'ecclesial-registry-history'/)
  assert.match(navigation, /href: '\/admin\/relaciones-eclesiales'/)
  assert.match(navigation, /'places\.update_proposal'/)
  assert.match(navigation, /'institutions\.update_proposal'/)
  assert.match(navigation, /'communications\.update_proposal'/)
})

test('the history service uses audited writers and dedicated history readers', async () => {
  const service = await read('src/features/ecclesial-registry/services/ecclesial-registry-history-service.ts')

  for (const rpc of [
    'admin_get_ecclesiastical_place',
    'admin_get_ecclesial_institution',
    'admin_list_ecclesiastical_place_affiliations',
    'admin_list_ecclesial_institution_affiliations',
    'admin_save_ecclesiastical_place',
    'admin_save_ecclesial_institution',
    'admin_save_communication_channel',
    'admin_save_ecclesiastical_place_affiliation',
    'admin_save_ecclesial_institution_affiliation',
    'admin_close_ecclesiastical_place_affiliation',
    'admin_close_ecclesial_institution_affiliation',
  ]) {
    assert.match(service, new RegExp(`'${rpc}'`))
  }

  assert.match(service, /id: input\.id/)
  assert.match(service, /primary_entity_id: input\.primaryEntityId/)
  assert.match(service, /is_primary_seat: input\.isPrimarySeat/)
})

test('the workspace separates parent edits from secondary relationship history', async () => {
  const page = await read('src/features/ecclesial-registry/admin/EcclesialRegistryHistoryPage.tsx')

  assert.match(page, /type RegistryRecordKind = 'place' \| 'institution' \| 'channel'/)
  assert.match(page, /Editar fichas y conservar relaciones históricas/)
  assert.match(page, /La afiliación primaria nunca se elimina desde la tabla de relaciones/)
  assert.match(page, /cambiar la pertenencia principal/i)
  assert.match(page, /handlePlaceUpdate/)
  assert.match(page, /handleInstitutionUpdate/)
  assert.match(page, /handleChannelUpdate/)
  assert.match(page, /handleAffiliationCreate/)
  assert.match(page, /handleAffiliationClose/)
  assert.match(page, /row\.is_primary_relation/)
  assert.match(page, /Editar desde la ficha/)
  assert.match(page, /Cerrar relación/)
})
