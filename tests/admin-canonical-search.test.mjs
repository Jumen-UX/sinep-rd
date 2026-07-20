import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile('supabase/migrations/20260718234000_create_canonical_admin_search.sql', 'utf8')
const route = await readFile('src/app/api/admin/search/route.ts', 'utf8')
const page = await readFile('src/features/admin/search/AdminSearchPage.tsx', 'utf8')
const routePage = await readFile('src/app/(admin)/admin/buscar/page.tsx', 'utf8')

test('canonical admin search separates domains permissions and scope', () => {
  assert.match(migration, /app_private\.admin_search_catalog/)
  assert.match(migration, /app_private\.admin_list_people\(v_query, v_limit\)/)
  assert.match(migration, /current_user_has_permission\('entities\.view'\)/)
  assert.match(migration, /current_user_has_permission\('pastorals\.view'\)/)
  assert.match(migration, /current_user_can\('entities\.view'/)
  assert.match(migration, /current_user_can\('pastorals\.view'/)
  assert.match(migration, /'person'::text/)
  assert.match(migration, /'entity'::text/)
  assert.match(migration, /'organization_unit'::text/)
})

test('search facade is authenticated bounded and keeps privileged implementation private', () => {
  assert.match(migration, /security definer/)
  assert.match(migration, /revoke all on function app_private\.admin_search_catalog\(text, integer\) from public, anon, authenticated/)
  assert.match(migration, /revoke all on function public\.admin_search_catalog\(text, integer\) from public, anon/)
  assert.match(migration, /grant execute on function public\.admin_search_catalog\(text, integer\) to authenticated/)
  assert.match(migration, /char_length\(v_query\) < 2/)
  assert.match(migration, /least\(greatest\(coalesce\(p_limit, 30\), 1\), 60\)/)
})

test('admin search API validates access and never caches scoped results', () => {
  assert.match(route, /requireAdminAccess/)
  assert.match(route, /MAX_QUERY_LENGTH = 120/)
  assert.match(route, /admin_search_catalog/)
  assert.match(page, /cache: 'no-store'/)
  assert.match(page, /Los dominios sin permiso o fuera de alcance no aparecen/)
})

test('search page exposes accessible query and explicit result destinations', () => {
  assert.match(routePage, /AdminSearchPage/)
  assert.match(page, /label htmlFor="canonical-admin-search"/)
  assert.match(page, /minLength=\{2\}/)
  assert.match(page, /resultLabels/)
  assert.match(page, /result\.href/)
  assert.match(page, /Sin resultados disponibles/)
})
