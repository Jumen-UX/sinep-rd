import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(
  new URL('../supabase/migrations/20260714050000_sync_clergy_profile_ordination_dates.sql', import.meta.url),
  'utf8',
)

test('ordination events remain the canonical source for clergy profile sacramental dates', () => {
  assert.match(migration, /create or replace function app_private\.sync_clergy_profile_ordination_dates\(\)/i)
  assert.match(migration, /pg_trigger_depth\(\) > 1/i)
  assert.match(migration, /ordination_events_sync_clergy_profile_dates/i)
  assert.match(migration, /max\(ordination_date\).*degree = 'diaconate'/is)
  assert.match(migration, /max\(ordination_date\).*degree = 'presbyterate'/is)
  assert.match(migration, /max\(ordination_date\).*degree = 'episcopate'/is)
})

test('the controlled backfill cannot recurse through the compatibility trigger', () => {
  assert.match(migration, /disable trigger clergy_profiles_sync_ordination_events/i)
  assert.match(migration, /enable trigger clergy_profiles_sync_ordination_events/i)
  assert.match(migration, /revoke all on function app_private\.sync_clergy_profile_ordination_dates\(\) from public, anon, authenticated/i)
})
