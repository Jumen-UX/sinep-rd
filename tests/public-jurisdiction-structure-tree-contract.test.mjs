import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const accountPlanMigrationUrl = new URL(
  '../supabase/migrations/20260805133000_create_jurisdiction_account_plan.sql',
  import.meta.url,
)

test('public jurisdiction account hierarchy is current, read-only and publication-safe', async () => {
  const sql = await readFile(accountPlanMigrationUrl, 'utf8')

  assert.match(sql, /create table if not exists public\.jurisdiction_accounts/i)
  assert.match(sql, /create table if not exists public\.jurisdiction_account_edges/i)
  assert.match(sql, /jurisdiction_account_edges_one_current_parent_idx/i)
  assert.match(sql, /where is_current and status='active'/i)
  assert.match(sql, /parent_account_id <> child_account_id/i)

  assert.match(sql, /create or replace view public\.public_jurisdiction_account_tree/i)
  assert.match(sql, /security_invoker=true/i)
  assert.match(sql, /account\.visibility='public'/i)
  assert.match(sql, /account\.is_current/i)
  assert.match(sql, /edge\.visibility='public'/i)
  assert.match(sql, /edge\.is_current/i)
  assert.match(sql, /edge\.valid_from<=current_date/i)
  assert.match(sql, /edge\.valid_to is null or edge\.valid_to>=current_date/i)
  assert.match(sql, /not child\.id=any\(parent\.path_ids\)/i)

  assert.match(sql, /revoke all on public\.public_jurisdiction_account_tree from public/i)
  assert.match(sql, /grant select on public\.public_jurisdiction_account_tree to anon,authenticated/i)
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete)\s+on\s+public\.public_jurisdiction_account_tree/i)
  assert.doesNotMatch(sql, /public_jurisdiction_structure_tree/i)
})
