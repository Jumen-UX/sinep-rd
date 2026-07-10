import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('database exposes one canonical registration engine with compatibility adapters', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260710220313_unified_canonical_person_registration_engine.sql',
  )

  assert.match(migration, /internal\.admin_save_canonical_person\(payload jsonb\)/)
  assert.match(migration, /v_flow not in \('layperson', 'religious', 'deacon', 'priest', 'bishop'\)/)
  assert.match(migration, /insert into public\.ordination_events/)
  assert.match(migration, /insert into public\.clerical_status_history/)
  assert.match(migration, /insert into public\.clerical_incardinations/)
  assert.match(migration, /insert into public\.religious_profiles/)
  assert.match(migration, /insert into public\.episcopal_roles/)
  assert.match(migration, /insert into public\.person_ecclesiastical_dignities/)
  assert.match(migration, /internal\.admin_save_position_assignment/)
  assert.match(migration, /create or replace function public\.admin_save_deacon/)
  assert.match(migration, /create or replace function public\.admin_save_priest/)
  assert.match(migration, /create or replace function public\.admin_save_bishop/)
  assert.match(migration, /create or replace function public\.admin_save_religious/)
  assert.match(migration, /create or replace function public\.admin_save_layperson/)
  assert.doesNotMatch(migration, /update public\.persons[\s\S]*?set\s+person_type\s*=/i)
})

test('candidate catalog is derived from canonical dimensions and scoped permissions', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260710220418_unified_canonical_registration_candidates.sql',
  )

  assert.match(migration, /admin_list_canonical_registration_candidates/)
  assert.match(migration, /from public\.person_ecclesial_state pes/)
  assert.match(migration, /current_user_can_manage_person/)
  assert.match(migration, /when 'priest' then pes\.has_diaconate and not pes\.has_presbyterate/)
  assert.match(migration, /when 'bishop' then pes\.has_presbyterate and not pes\.has_episcopate/)
  assert.doesNotMatch(migration, /person_type\s*=/)
})

test('application uses one endpoint and shared service for canonical registration', async () => {
  const service = await readRepoFile(
    'src/features/personas/shared/services/canonical-person-registration-service.ts',
  )
  const route = await readRepoFile('src/app/api/admin/persona-canonica/route.ts')

  assert.match(service, /admin_list_canonical_registration_candidates/)
  assert.match(service, /\/api\/admin\/persona-canonica/)
  assert.match(route, /rpc\('admin_save_canonical_person'/)
  assert.match(route, /person\.canonical\.\$\{flow\}\.\$\{mode\}/)
  assert.match(route, /selected_person_id/)
})

test('specialized services are thin canonical adapters', async () => {
  const files = [
    ['src/features/clero/deacon/services/deacon-admin-service.ts', 'deacon'],
    ['src/features/clero/priest/services/priest-admin-service.ts', 'priest'],
    ['src/features/clero/bishop/services/bishop-admin-service.ts', 'bishop'],
    ['src/features/vida-consagrada/religious/services/religious-admin-service.ts', 'religious'],
    ['src/features/personas/lay/services/lay-person-admin-service.ts', 'layperson'],
  ]

  for (const [path, flow] of files) {
    const content = await readRepoFile(path)
    assert.match(content, /saveCanonicalPersonRegistration/)
    assert.match(content, new RegExp(`saveCanonicalPersonRegistration\\('${flow}'`))
    assert.doesNotMatch(content, /fetch\('\/api\/admin\/(diacono|sacerdote|obispo|religioso|laico)'/)
  }
})

test('religious and lay wizards can reuse an existing person', async () => {
  const religious = await readRepoFile(
    'src/features/vida-consagrada/religious/admin/ReligiousWizardPage.tsx',
  )
  const lay = await readRepoFile('src/features/personas/lay/admin/LayPersonWizardPage.tsx')

  for (const page of [religious, lay]) {
    assert.match(page, /mode, setMode/)
    assert.match(page, /selected_person_id/)
    assert.match(page, /¿La persona ya está registrada\?/)
    assert.match(page, /mode === 'existing'/)
  }

  assert.match(religious, /sin duplicar su identidad/)
  assert.match(lay, /sin crear una identidad duplicada/)
})
