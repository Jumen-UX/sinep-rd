import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const validationMigrationPath = 'supabase/migrations/20260714053000_validate_admin_invitation_role_scope.sql'
const inviteApiPath = 'src/app/api/admin/users/create-invite/route.ts'
const invitePagePath = 'src/features/access/admin/InviteUserPage.tsx'

test('role and scope are validated before Supabase sends an invitation', async () => {
  const [sql, api] = await Promise.all([
    readFile(validationMigrationPath, 'utf8'),
    readFile(inviteApiPath, 'utf8'),
  ])

  assert.match(sql, /function app_private\.validate_admin_role_scope\(payload jsonb\)/)
  assert.match(sql, /current_user_has_permission\('users\.assign_roles'\)/)
  assert.match(sql, /admin_list_role_scope_options\(v_scope_type\)/)
  assert.match(sql, /La entidad seleccionada no está disponible dentro de tu alcance/)
  assert.match(sql, /revoke all on function app_private\.validate_admin_role_scope\(jsonb\) from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.validate_admin_role_scope\(jsonb\) to authenticated, service_role/)

  const validationIndex = api.indexOf("rpc('validate_admin_role_scope'")
  const invitationIndex = api.indexOf('inviteUserByEmail')
  assert.ok(validationIndex >= 0 && validationIndex < invitationIndex)
  assert.match(api, /status: 'pending_invitation'/)
  assert.doesNotMatch(api, /status: 'pending',/)
})

test('invitation UI requires explicit confirmation of initial access', async () => {
  const page = await readFile(invitePagePath, 'utf8')
  assert.match(page, /accessConfirmed/)
  assert.match(page, /Confirma el rol y el alcance antes de enviar la invitación/)
  assert.match(page, /Confirmo que este rol y alcance corresponden al usuario invitado/)
  assert.match(page, /disabled=\{saving \|\| Boolean\(roleId && !accessConfirmed\)\}/)
})

test('invitation and access mutations retain their audit boundaries', async () => {
  const [api, assignmentSql, statusSql] = await Promise.all([
    readFile(inviteApiPath, 'utf8'),
    readFile('supabase/migrations/20260714005000_migrate_role_scope_calendar_and_assignment_functions_to_units.sql', 'utf8'),
    readFile('supabase/migrations/20260713211000_align_profile_status_workflow.sql', 'utf8'),
  ])

  assert.match(api, /recordAdminAudit/)
  assert.match(api, /onboarding_state/)
  assert.match(assignmentSql, /'admin_assign_user_role'/)
  assert.match(statusSql, /'admin_update_user_profile_status'/)
})
