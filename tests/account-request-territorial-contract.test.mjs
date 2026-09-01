import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = 'supabase/migrations/20260901230250_territorialize_account_access_requests.sql'
const verificationPath = 'supabase/verification/verify_account_request_territorial_security.sql'
const servicePath = 'src/features/account/services/account-service.ts'
const managerPath = 'src/features/account/AccountRequestManager.tsx'
const pagePath = 'src/app/(account)/cuenta/solicitudes/page.tsx'

test('account requests use ISO2 as their canonical territorial anchor', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /requested_country_iso2 char\(2\)/)
  assert.match(sql, /references public\.country_catalog\(iso2\)/)
  assert.match(sql, /access_requests_country_status_idx/)
  assert.match(sql, /requested_country_entity_id[\s\S]*Legacy compatibility only/)
})

test('national admins review only requests inside their country while super admin remains global', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  const reviewFunction = sql.match(/create or replace function app_private\.admin_review_access_request[\s\S]*?\$function\$;/i)?.[0] ?? ''

  assert.match(reviewFunction, /current_user_has_role\(array\['super_admin'\]\)/)
  assert.match(reviewFunction, /current_user_can_manage_country\('users\.manage', v_row\.requested_country_iso2\)/)
  assert.match(reviewFunction, /La solicitud está fuera de tu ámbito territorial/)
})

test('self service requires structured destinations and seals person-link bypass', async () => {
  const [sql, service, manager] = await Promise.all([
    readFile(migrationPath, 'utf8'),
    readFile(servicePath, 'utf8'),
    readFile(managerPath, 'utf8'),
  ])

  assert.match(sql, /v_type not in \('initial_access','scope_change','role_change','account_closure'\)/)
  assert.doesNotMatch(sql, /v_type not in \([^\)]*person_link/)
  assert.match(sql, /is_requestable_account_scope/)
  assert.match(service, /requested_country_iso2: input\.countryIso2/)
  assert.match(service, /requested_role_id: input\.requestedRoleId/)
  assert.match(service, /requested_scope_type: input\.requestedScopeType/)
  assert.match(service, /list_account_request_scopes/)
  assert.match(manager, /País <em>Obligatorio<\/em>/)
  assert.match(manager, /Rol solicitado <em>Obligatorio<\/em>/)
  assert.match(manager, /Ámbito solicitado <em>Obligatorio<\/em>/)
  assert.match(manager, /administrador nacional del país seleccionado/)
})

test('scope discovery remains authenticated through a security-invoker public facade', async () => {
  const [sql, verification] = await Promise.all([
    readFile(migrationPath, 'utf8'),
    readFile(verificationPath, 'utf8'),
  ])

  assert.match(sql, /create or replace function public\.list_account_request_scopes/)
  assert.match(sql, /security invoker/)
  assert.match(sql, /revoke all on function public\.list_account_request_scopes\(char\(2\), text\) from public, anon/)
  assert.match(verification, /Public scope-list facade must remain SECURITY INVOKER/)
})

test('request page passes structured options and surfaces the territorial anchor in history', async () => {
  const page = await readFile(pagePath, 'utf8')

  assert.match(page, /request_options: requestOptions/)
  assert.match(page, /requestOptions=\{requestOptions\}/)
  assert.match(page, /<dt>País<\/dt>/)
  assert.match(page, /Solicitud histórica sin país/)
})
