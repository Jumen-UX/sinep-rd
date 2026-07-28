import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)
const migrations = {
  foundation: '20260728212144_create_ecclesial_registry_foundation.sql',
  security: '20260728212411_secure_ecclesial_registry_by_country.sql',
  writers: '20260728212649_add_ecclesial_registry_admin_rpcs.sql',
  affiliations: '20260728212747_add_ecclesial_registry_affiliation_rpcs.sql',
  indexes: '20260728213412_index_ecclesial_registry_foreign_keys.sql',
}

async function readMigration(fileName) {
  return readFile(new URL(`supabase/migrations/${fileName}`, repoRoot), 'utf8')
}

function functionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`)
  assert.notEqual(start, -1, `${functionName} must exist`)
  const end = source.indexOf('create or replace function', start + functionName.length + 20)
  return source.slice(start, end === -1 ? source.length : end)
}

test('repository versions the complete ecclesial registry migration sequence', async () => {
  const files = await readdir(new URL('supabase/migrations/', repoRoot))
  for (const fileName of Object.values(migrations)) {
    assert.equal(files.includes(fileName), true, `${fileName} must be committed`)
  }
})

test('canonical entities, physical places, institutions and channels are separate records', async () => {
  const migration = await readMigration(migrations.foundation)

  assert.match(migration, /create table if not exists public\.ecclesiastical_places/)
  assert.match(migration, /create table if not exists public\.ecclesial_institutions/)
  assert.match(migration, /create table if not exists public\.communication_channels/)
  assert.match(migration, /primary_entity_id uuid not null references public\.ecclesiastical_entities/)
  assert.match(migration, /owner_place_id uuid references public\.ecclesiastical_places/)
  assert.match(migration, /owner_institution_id uuid references public\.ecclesial_institutions/)
  assert.match(migration, /num_nonnulls\(owner_entity_id, owner_organization_unit_id, owner_place_id, owner_institution_id\) = 1/)
})

test('temple history keeps dedication and consecration as different facts', async () => {
  const migration = await readMigration(migrations.foundation)

  assert.match(migration, /dedicated_at date/)
  assert.match(migration, /consecrated_at date/)
  assert.match(migration, /consecrated_at is null or dedicated_at is null or consecrated_at >= dedicated_at/)
  assert.match(migration, /allows_dedication boolean/)
  assert.match(migration, /allows_consecration boolean/)
  assert.match(migration, /'chapel','Capilla'.*true,true,false/s)
  assert.match(migration, /'church','Iglesia'.*true,true,true/s)
})

test('legacy records are mapped without deleting their canonical identity', async () => {
  const migration = await readMigration(migrations.foundation)

  assert.match(migration, /legacy_entity_id uuid unique references public\.ecclesiastical_entities/)
  assert.match(migration, /entity_type\.key in \('chapel','sanctuary'\)/)
  assert.match(migration, /entity_type\.key in \('seminary','religious_house','special_center'\)/)
  assert.match(migration, /not exists\(select 1 from public\.ecclesiastical_places existing where existing\.legacy_entity_id=entity\.id\)/)
  assert.match(migration, /not exists\(select 1 from public\.ecclesial_institutions existing where existing\.legacy_entity_id=entity\.id\)/)
  assert.doesNotMatch(migration, /delete from public\.ecclesiastical_entities/i)
})

test('institution categories cover education, health, formation, consecrated life and media', async () => {
  const migration = await readMigration(migrations.foundation)

  for (const category of ['school', 'university', 'dispensary', 'seminary', 'monastery', 'radio', 'television', 'digital_media']) {
    assert.match(migration, new RegExp(`'${category}'`))
  }
  assert.match(migration, /parent_category_id uuid references public\.ecclesial_institution_categories/)
})

test('country context is derived from canonical owners and cross-country affiliations fail closed', async () => {
  const migration = await readMigration(migrations.security)
  const placeTrigger = functionBody(migration, 'app_private.derive_ecclesiastical_place_context')
  const institutionTrigger = functionBody(migration, 'app_private.derive_ecclesial_institution_context')
  const placeAffiliation = functionBody(migration, 'app_private.validate_ecclesiastical_place_affiliation')
  const institutionAffiliation = functionBody(migration, 'app_private.validate_ecclesial_institution_affiliation')

  assert.match(placeTrigger, /resolve_entity_country_iso2\(new\.primary_entity_id\)/)
  assert.match(placeTrigger, /new\.country_iso2 := v_country/)
  assert.match(institutionTrigger, /resolve_entity_country_iso2\(new\.primary_entity_id\)/)
  assert.match(institutionTrigger, /new\.country_iso2 := v_country/)
  assert.match(placeAffiliation, /v_place_country <> v_target_country/)
  assert.match(institutionAffiliation, /v_institution_country <> v_target_country/)
  assert.match(placeTrigger, /not v_allows_consecration/)
})

test('registry RLS exposes only public active rows and uses typed scoped helpers', async () => {
  const migration = await readMigration(migrations.security)

  assert.match(migration, /alter table public\.ecclesiastical_places enable row level security/)
  assert.match(migration, /alter table public\.ecclesial_institutions enable row level security/)
  assert.match(migration, /alter table public\.communication_channels enable row level security/)
  assert.match(migration, /status='active' and visibility='public'/)
  assert.match(migration, /current_user_can_manage_ecclesiastical_place\('places\.view',id\)/)
  assert.match(migration, /current_user_can_manage_ecclesial_institution\('institutions\.view',id\)/)
  assert.match(migration, /current_user_can_manage_communication_channel\('communications\.view',id\)/)
  assert.match(migration, /revoke insert,update,delete on public\.ecclesiastical_places/)
  assert.doesNotMatch(migration, /current_user_is_super_or_national|current_user_is_admin/)
})

test('public writer facades are SECURITY INVOKER and anonymous execution is revoked', async () => {
  const migration = await readMigration(migrations.writers)

  for (const functionName of [
    'public.admin_save_ecclesiastical_place',
    'public.admin_save_ecclesial_institution',
    'public.admin_save_communication_channel',
  ]) {
    const body = functionBody(migration, functionName)
    assert.match(body, /security invoker/)
    assert.match(body, /app_private\.rpc_definer__/)
  }

  assert.match(migration, /revoke all on function public\.admin_save_ecclesiastical_place\(jsonb\) from public,anon/)
  assert.match(migration, /revoke all on function public\.admin_save_ecclesial_institution\(jsonb\) from public,anon/)
  assert.match(migration, /revoke all on function public\.admin_save_communication_channel\(jsonb\) from public,anon/)
  assert.doesNotMatch(functionBody(migration, 'public.admin_save_ecclesiastical_place'), /security definer/)
})

test('publishing places and institutions requires explicit publish permission', async () => {
  const migration = await readMigration(migrations.writers)
  const placeWriter = functionBody(migration, 'app_private.rpc_definer__admin_save_ecclesiastical_place')
  const institutionWriter = functionBody(migration, 'app_private.rpc_definer__admin_save_ecclesial_institution')

  assert.match(placeWriter, /current_user_can_manage_entity\('places\.publish',v_primary_entity_id\)/)
  assert.match(institutionWriter, /current_user_can_manage_entity\('institutions\.publish',v_primary_entity_id\)/)
  assert.match(placeWriter, /public\.create_audit_log/)
  assert.match(institutionWriter, /public\.create_audit_log/)
  assert.match(placeWriter, /'country_iso2',v_country/)
  assert.match(institutionWriter, /'country_iso2',v_country/)
})

test('communication channels support every owner domain and validate normalized values', async () => {
  const foundation = await readMigration(migrations.foundation)
  const security = await readMigration(migrations.security)
  const writer = await readMigration(migrations.writers)

  for (const channel of ['phone', 'email', 'website', 'facebook', 'instagram', 'youtube', 'radio_frequency', 'tv_channel', 'podcast', 'streaming']) {
    assert.match(foundation, new RegExp(`'${channel}'`))
  }
  assert.match(security, /v_kind='email'/)
  assert.match(security, /v_kind='url'/)
  assert.match(writer, /num_nonnulls\(v_owner_entity_id,v_owner_unit_id,v_owner_place_id,v_owner_institution_id\)<>1/)
  assert.match(writer, /communications\.channel\.created/)
})

test('affiliation writers preserve relationship history and audit their changes', async () => {
  const migration = await readMigration(migrations.affiliations)

  assert.match(migration, /admin_save_ecclesiastical_place_affiliation/)
  assert.match(migration, /admin_save_ecclesial_institution_affiliation/)
  assert.match(migration, /valid_from/)
  assert.match(migration, /valid_to/)
  assert.match(migration, /is_current/)
  assert.match(migration, /places\.affiliation\.created/)
  assert.match(migration, /institutions\.affiliation\.created/)
  assert.match(migration, /security invoker/)
  assert.match(migration, /revoke all on function public\.admin_save_ecclesiastical_place_affiliation\(jsonb\) from public,anon/)
})

test('public registry views are security invoker and filter to active public rows', async () => {
  const migration = await readMigration(migrations.writers)

  assert.match(migration, /create or replace view public\.public_ecclesiastical_places\s+with \(security_invoker=true\)/)
  assert.match(migration, /create or replace view public\.public_ecclesial_institutions\s+with \(security_invoker=true\)/)
  assert.match(migration, /create or replace view public\.public_communication_channels\s+with \(security_invoker=true\)/)
  assert.match(migration, /where place\.status='active' and place\.visibility='public'/)
  assert.match(migration, /where institution\.status='active' and institution\.visibility='public'/)
  assert.match(migration, /where channel\.status='active' and channel\.visibility='public'/)
})

test('all new registry foreign keys receive covering indexes', async () => {
  const migration = await readMigration(migrations.indexes)

  for (const indexName of [
    'ecclesiastical_places_place_type_id_idx',
    'ecclesiastical_places_source_document_id_idx',
    'ecclesiastical_places_created_by_idx',
    'ecclesial_institution_categories_parent_id_idx',
    'ecclesial_institutions_category_id_idx',
    'ecclesial_institutions_source_document_id_idx',
    'ecclesial_institutions_created_by_idx',
    'ecclesiastical_place_affiliations_source_document_id_idx',
    'ecclesiastical_place_affiliations_created_by_idx',
    'ecclesial_institution_affiliations_source_document_id_idx',
    'ecclesial_institution_affiliations_created_by_idx',
    'communication_channels_channel_type_id_idx',
    'communication_channels_source_document_id_idx',
    'communication_channels_created_by_idx',
  ]) {
    assert.match(migration, new RegExp(indexName))
  }
})
