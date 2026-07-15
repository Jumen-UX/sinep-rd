import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const repoRoot = new URL('../', import.meta.url)

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), 'utf8')
}

test('deacon priest and bishop transitions reuse one canonical person id', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260710220313_unified_canonical_person_registration_engine.sql',
  )

  assert.match(
    migration,
    /v_selected_person_id uuid := coalesce\([\s\S]*?selected_person_id[\s\S]*?existing_deacon_person_id[\s\S]*?selected_clergy_id[\s\S]*?\);/,
  )
  assert.match(migration, /v_person_id uuid;/)
  assert.match(migration, /where p\.id = v_selected_person_id[\s\S]*?for update;/)
  assert.match(migration, /'person_id', v_person_id/)
  assert.match(migration, /return jsonb_build_object\([\s\S]*?'person_id', v_person_id/)

  assert.match(
    migration,
    /create or replace function public\.admin_save_priest\(payload jsonb\)[\s\S]*?'selected_person_id', payload->'existing_deacon_person_id'/,
  )
  assert.match(
    migration,
    /create or replace function public\.admin_save_bishop\(payload jsonb\)[\s\S]*?'selected_person_id', payload->'selected_clergy_id'/,
  )
})

test('clerical transitions enforce sacramental prerequisites without creating another identity', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260710220313_unified_canonical_person_registration_engine.sql',
  )

  assert.match(
    migration,
    /v_flow = 'priest' and \(not v_has_diaconate or v_has_presbyterate or v_has_episcopate\)/,
  )
  assert.match(
    migration,
    /La persona seleccionada debe tener diaconado y no poseer todavía presbiterado/,
  )
  assert.match(
    migration,
    /v_flow = 'bishop' and \(not v_has_presbyterate or v_has_episcopate\)/,
  )
  assert.match(
    migration,
    /La persona seleccionada debe tener presbiterado y no poseer todavía episcopado/,
  )

  const existingBranch = migration.match(
    /if v_mode = 'existing' then([\s\S]*?)else\n\s+v_first_name :=/,
  )?.[1] ?? ''

  assert.match(existingBranch, /v_person_id/)
  assert.doesNotMatch(existingBranch, /insert into public\.persons/)
})

test('ordination and clergy history are accumulated on the reused person id', async () => {
  const migration = await readRepoFile(
    'supabase/migrations/20260710220313_unified_canonical_person_registration_engine.sql',
  )

  for (const degree of ['diaconate', 'presbyterate', 'episcopate']) {
    assert.match(
      migration,
      new RegExp(`v_person_id, '${degree}'`),
    )
  }

  assert.match(migration, /on conflict \(person_id, degree\) do update set/)
  assert.match(migration, /insert into public\.clergy_profiles \([\s\S]*?v_person_id/)
  assert.match(migration, /on conflict \(person_id\) do update set/)
  assert.match(migration, /where csh\.person_id = v_person_id/)
  assert.match(migration, /where ci\.person_id = v_person_id/)
})
