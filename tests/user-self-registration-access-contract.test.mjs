import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationPath = 'supabase/migrations/20260803120000_user_self_registration_and_access_requests.sql'
const facadeFixPath = 'supabase/migrations/20260803120100_fix_account_rpc_facade_security.sql'

test('account profile extends the existing access identity without duplicating auth roles or persons', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /alter table public\.profiles/)
  assert.match(sql, /person_id uuid references public\.persons\(id\) on delete set null/)
  assert.match(sql, /registration_source text not null default 'invitation'/)
  assert.match(sql, /preferred_locale text not null default 'es-419'/)
  assert.match(sql, /timezone text not null default 'America\/Santo_Domingo'/)
  assert.match(sql, /profiles_person_id_unique_idx/)
  assert.doesNotMatch(sql, /create table if not exists public\.users\b/i)
  assert.doesNotMatch(sql, /create table if not exists public\.user_roles\b/i)
})

test('new auth users receive a controlled profile but no role or scope automatically', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /create or replace function app_private\.handle_new_auth_user_profile\(\)/)
  assert.match(sql, /registration_source' = 'self_registration'/)
  assert.match(sql, /'pending_invitation'/)
  assert.doesNotMatch(sql, /insert into public\.user_role_assignments[\s\S]*handle_new_auth_user_profile/i)
})

test('access requests are user-owned, lifecycle constrained and RPC-only for writes', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /create table if not exists public\.access_requests/)
  assert.match(sql, /request_type in \('initial_access', 'person_link', 'scope_change', 'role_change', 'account_closure'\)/)
  assert.match(sql, /status in \('draft', 'submitted', 'under_review', 'information_required', 'approved', 'rejected', 'cancelled'\)/)
  assert.match(sql, /alter table public\.access_requests enable row level security/)
  assert.match(sql, /using \(user_id = \(select auth\.uid\(\)\)\)/)
  assert.match(sql, /revoke all on table public\.access_requests from public, anon, authenticated/)
  assert.match(sql, /grant select on table public\.access_requests to authenticated/)
  assert.doesNotMatch(sql, /grant (insert|update|delete|all) on table public\.access_requests to authenticated/i)
})

test('users can manage only their own request lifecycle and cannot self-review', async () => {
  const sql = await readFile(migrationPath, 'utf8')

  assert.match(sql, /v_user_id uuid := auth\.uid\(\)/)
  assert.match(sql, /where id = v_request_id\s+and user_id = v_user_id/)
  assert.match(sql, /status in \('draft', 'submitted', 'information_required'\)/)
  assert.match(sql, /not app_private\.current_user_has_permission\('users\.manage'\)/)
  assert.match(sql, /if v_row\.user_id = v_actor_id then/)
  assert.match(sql, /No puedes revisar tu propia solicitud/)
})

test('approval never grants roles automatically and only person-link approval may attach an existing person', async () => {
  const sql = await readFile(migrationPath, 'utf8')
  const reviewFunction = sql.match(/create or replace function app_private\.admin_review_access_request[\s\S]*?\$function\$;/i)?.[0] ?? ''

  assert.match(reviewFunction, /request_type = 'person_link'/)
  assert.match(reviewFunction, /update public\.profiles[\s\S]*set person_id = v_row\.requested_person_id/)
  assert.doesNotMatch(reviewFunction, /insert into public\.user_role_assignments/i)
  assert.doesNotMatch(reviewFunction, /update public\.user_role_assignments/i)
})

test('account RPC facades remain authenticated, sealed and unavailable to anonymous clients', async () => {
  const [sql, facadeFix] = await Promise.all([
    readFile(migrationPath, 'utf8'),
    readFile(facadeFixPath, 'utf8'),
  ])

  assert.match(sql, /revoke all on function app_private\.get_my_account_context\(\) from public, anon, authenticated/)
  assert.match(sql, /revoke all on function app_private\.submit_my_access_request\(jsonb\) from public, anon, authenticated/)
  assert.match(facadeFix, /create or replace function public\.get_my_account_context\(\)[\s\S]*security definer/)
  assert.match(facadeFix, /revoke all on function public\.get_my_account_context\(\) from public, anon/)
  assert.match(facadeFix, /grant execute on function public\.get_my_account_context\(\) to authenticated, service_role/)
  assert.match(facadeFix, /revoke all on function public\.admin_review_access_request\(jsonb\) from public, anon/)
})
