import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('public active navigation keeps explicit accessible contrast', async () => {
  const [css, tokens] = await Promise.all([
    read('src/app/globals.css'),
    read('src/styles/ui-system.css'),
  ])

  assert.match(css, /\.public-sidebar-link\.active > span:nth-child\(2\)/)
  assert.match(css, /color: var\(--text-strong\)/)
  assert.match(css, /#tab-territorial\[aria-selected="true"\] > span:nth-child\(2\)/)
  assert.match(css, /color: var\(--primary-hover\)/)
  assert.match(tokens, /html\[data-theme='dark'\][\s\S]*--text-strong:\s*#ffffff/)
  assert.match(tokens, /html\[data-theme='dark'\][\s\S]*--primary-hover:\s*#f0b1b1/)
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
