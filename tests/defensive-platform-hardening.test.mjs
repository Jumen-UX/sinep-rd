import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('Next.js applies defensive headers to every route', async () => {
  const config = await read('next.config.ts')

  assert.match(config, /poweredByHeader: false/)
  assert.match(config, /source: '\/:path\*'/)
  assert.match(config, /Content-Security-Policy/)
  assert.match(config, /X-Content-Type-Options.*nosniff/s)
  assert.match(config, /Referrer-Policy.*strict-origin-when-cross-origin/s)
  assert.match(config, /Permissions-Policy.*camera=\(\), microphone=\(\), geolocation=\(\)/s)
  assert.match(config, /frame-ancestors 'none'/)
  assert.match(config, /object-src 'none'/)
  assert.match(config, /connect-src 'self' https:\/\/\*\.supabase\.co wss:\/\/\*\.supabase\.co/)
})

test('country membership foreign keys receive dedicated indexes', async () => {
  const migration = await read('supabase/migrations/20260801205355_add_country_membership_fk_indexes.sql')

  assert.match(migration, /user_country_membership_sources \(created_by\)/)
  assert.match(migration, /user_country_memberships \(country_entity_id\)/)
  assert.match(migration, /user_country_memberships \(created_by\)/)
  assert.match(migration, /user_country_memberships \(ended_by\)/)
  assert.equal((migration.match(/create index if not exists/g) ?? []).length, 4)
})

test('unexposed administrative views also execute as invoker', async () => {
  const migration = await read('supabase/migrations/20260801205359_set_admin_import_views_security_invoker.sql')

  assert.equal((migration.match(/set \(security_invoker = true\)/g) ?? []).length, 2)
  assert.match(migration, /admin_import_clergy_directory_review\s+from public, anon, authenticated/s)
  assert.match(migration, /admin_import_clergy_directory_review_summary\s+from public, anon, authenticated/s)
})
