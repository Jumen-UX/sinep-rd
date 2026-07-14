import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = 'supabase/migrations/20260714233000_scope_structure_level_office_options.sql'
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('structure level office options never fall back to every active office', async () => {
  const migration = await read(migrationPath)

  assert.match(migration, /allowed_charts/)
  assert.match(migration, /peer\.level_key = lc\.level_key/)
  assert.match(migration, /oc\.organization_chart_id in \(select organization_chart_id from allowed_charts\)/)
  assert.match(migration, /'has_explicit_scope'/)
  assert.match(migration, /app_private\.structure_template_in_scope/)
  assert.doesNotMatch(
    migration,
    /from public\.office_configurations oc where oc\.status\s*=\s*'active'\s*\)\s*,\s*'\[\]'::jsonb\)/,
  )
})
