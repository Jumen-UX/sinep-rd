import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('public active navigation keeps explicit accessible contrast', async () => {
  const css = await read('src/app/globals.css')

  assert.match(css, /\.public-sidebar-link\.active > span:nth-child\(2\)/)
  assert.match(css, /color: #ffffff/)
  assert.match(css, /#tab-territorial\[aria-selected="true"\] > span:nth-child\(2\)/)
  assert.match(css, /color: #5e1717/)
})

test('public episcopal succession can read only the source columns required by its invoker view', async () => {
  const sql = await read('supabase/migrations/20260714051000_grant_public_episcopal_view_source_columns.sql')

  assert.match(sql, /grant select \(/i)
  assert.match(sql, /ordination_date/)
  assert.match(sql, /verification_status/)
  assert.match(sql, /notes_public/)
  assert.match(sql, /on public\.ordination_events to anon, authenticated/i)
  assert.doesNotMatch(sql, /grant all/i)
})
