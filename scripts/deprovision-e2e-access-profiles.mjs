import { createClient } from '@supabase/supabase-js'

const REQUIRED_CONFIRMATION = 'DEPROVISION_NON_PRODUCTION_E2E'
const REQUIRED_DELETE_CONFIRMATION = 'DELETE_NON_PRODUCTION_E2E_USERS'
const DEFAULT_EMAIL_DOMAIN = 'example.test'
const MAX_USER_PAGES = 20
const USERS_PER_PAGE = 1000

function requiredEnv(name, fallback) {
  const value = process.env[name]?.trim() || fallback
  if (!value) throw new Error(`Falta la variable obligatoria ${name}.`)
  return value
}

function normalizeMode() {
  const mode = process.env.E2E_DEPROVISION_MODE?.trim().toLowerCase() || 'suspend'
  if (!['suspend', 'delete'].includes(mode)) {
    throw new Error('E2E_DEPROVISION_MODE solo admite suspend o delete.')
  }
  return mode
}

function assertSafeInputs({ emailDomain, mode }) {
  if (process.env.E2E_DEPROVISION_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error(`Define E2E_DEPROVISION_CONFIRM=${REQUIRED_CONFIRMATION} para confirmar el entorno no productivo.`)
  }

  if (!emailDomain.endsWith('.test') && !emailDomain.endsWith('.invalid')) {
    throw new Error('El dominio de las cuentas E2E debe terminar en .test o .invalid.')
  }

  if (mode === 'delete' && process.env.E2E_DELETE_CONFIRM !== REQUIRED_DELETE_CONFIRMATION) {
    throw new Error(`La eliminación requiere E2E_DELETE_CONFIRM=${REQUIRED_DELETE_CONFIRMATION}.`)
  }
}

async function listAllUsers(supabase) {
  const users = []

  for (let page = 1; page <= MAX_USER_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE })
    if (error) throw new Error(`No se pudieron listar usuarios de Auth: ${error.message}`)

    users.push(...data.users)
    if (data.users.length < USERS_PER_PAGE) return users
  }

  throw new Error(`La búsqueda de usuarios superó ${MAX_USER_PAGES * USERS_PER_PAGE} registros.`)
}

function selectDedicatedUsers(users, emailDomain) {
  const suffix = `@${emailDomain}`.toLowerCase()
  return users.filter((user) => (
    user.app_metadata?.e2e_access_profile === true
    && user.email?.toLowerCase().endsWith(suffix)
  ))
}

async function blockApplicationAccess(supabase, user) {
  const now = new Date().toISOString()
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ status: 'suspended', updated_at: now })
    .eq('id', user.id)

  if (profileError) throw new Error(`No se pudo suspender el perfil ${user.id}: ${profileError.message}`)

  const { error: roleError } = await supabase
    .from('user_role_assignments')
    .delete()
    .eq('user_id', user.id)

  if (roleError) throw new Error(`No se pudieron retirar los roles de ${user.id}: ${roleError.message}`)
}

async function registerAudit(supabase, user, mode) {
  const { error } = await supabase.from('audit_logs').insert({
    action: mode === 'delete' ? 'delete_e2e_access_profile' : 'suspend_e2e_access_profile',
    target_table: 'profiles',
    target_id: user.id,
    scope_type: 'unknown',
    outcome: 'success',
    new_data: {
      e2e_profile_key: user.app_metadata?.e2e_profile_key ?? null,
      deprovision_mode: mode,
    },
  })

  if (error) throw new Error(`No se pudo auditar la baja de ${user.id}: ${error.message}`)
}

async function verifyBlocked(supabase, userIds) {
  if (userIds.length === 0) return

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id,status')
    .in('id', userIds)
  if (profileError) throw new Error(`No se pudieron verificar los perfiles suspendidos: ${profileError.message}`)

  const { data: assignments, error: roleError } = await supabase
    .from('user_role_assignments')
    .select('user_id')
    .in('user_id', userIds)
  if (roleError) throw new Error(`No se pudieron verificar los roles retirados: ${roleError.message}`)

  if (profiles.some((profile) => profile.status !== 'suspended')) {
    throw new Error('Uno o más perfiles E2E no quedaron suspendidos.')
  }
  if (assignments.length > 0) {
    throw new Error('Uno o más perfiles E2E conservan asignaciones de rol.')
  }
}

async function deleteAuthUsers(supabase, users) {
  for (const user of users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) throw new Error(`No se pudo eliminar el usuario ${user.id}: ${error.message}`)
  }
}

async function verifyDeleted(supabase, deletedIds) {
  if (deletedIds.length === 0) return
  const remaining = await listAllUsers(supabase)
  const remainingIds = new Set(remaining.map((user) => user.id))
  if (deletedIds.some((id) => remainingIds.has(id))) {
    throw new Error('Uno o más usuarios E2E continúan presentes en Supabase Auth.')
  }
}

async function main() {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.SUPABASE_URL?.trim())
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  const emailDomain = requiredEnv('E2E_ACCESS_EMAIL_DOMAIN', DEFAULT_EMAIL_DOMAIN)
  const mode = normalizeMode()

  assertSafeInputs({ emailDomain, mode })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  const users = selectDedicatedUsers(await listAllUsers(supabase), emailDomain)
  if (users.length === 0) {
    console.log('No se encontraron cuentas E2E dedicadas para desactivar.')
    return
  }

  for (const user of users) {
    await blockApplicationAccess(supabase, user)
    await registerAudit(supabase, user, mode)
  }
  await verifyBlocked(supabase, users.map((user) => user.id))

  if (mode === 'delete') {
    await deleteAuthUsers(supabase, users)
    await verifyDeleted(supabase, users.map((user) => user.id))
  }

  console.log(`${users.length} cuentas E2E procesadas en modo ${mode}.`)
  if (mode === 'suspend') {
    console.log('Los perfiles quedaron suspendidos y sin roles. El aprovisionador podrá reactivarlos con contraseñas nuevas.')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Error desconocido al desactivar la matriz E2E.')
  process.exitCode = 1
})
