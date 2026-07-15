import type { SupabaseClient } from '@supabase/supabase-js'

const LOGIN_TIMEOUT_MS = 15_000
const RECOVERY_SESSION_TIMEOUT_MS = 8_000

type ResetAccessResponse = {
  error?: string
}

export type OnboardingRole = {
  assignment_id: string
  role_key: string
  role_name: string
  scope_type: string
  scope_entity_id: string | null
  scope_label: string
}

export type AdminOnboardingContext = {
  user_id: string
  email: string
  full_name: string
  phone: string | null
  profile_status: string
  onboarding_step: 'profile' | 'access' | 'complete'
  onboarding_completed_at: string | null
  roles: OnboardingRole[]
}

export type AdminEntryContext = {
  user_id: string
  email: string
  profile_status: 'pending_invitation' | 'active' | 'suspended' | 'inactive' | string
  onboarding_completed_at: string | null
  has_admin_role: boolean
  access_state: 'ready' | 'onboarding' | 'no_role' | 'blocked'
}

function withTimeout<T>(promise: Promise<T>, timeoutMessage: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), LOGIN_TIMEOUT_MS)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  })
}

export function getSafeAdminNextPath(search: string) {
  const next = new URLSearchParams(search).get('next')
  if (!next || !next.startsWith('/admin') || next.startsWith('//') || next.includes('\\')) return '/admin'

  try {
    const base = 'https://sinep.local'
    const parsed = new URL(next, base)
    const reservedPaths = ['/admin/login', '/admin/onboarding', '/admin/recuperar', '/admin/acceso']
    if (parsed.origin !== base || !parsed.pathname.startsWith('/admin')) return '/admin'
    if (reservedPaths.some((path) => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`))) return '/admin'
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return '/admin'
  }
}

export function getAdminLoginErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === 'login-timeout') {
    return 'Supabase no respondió a tiempo. Revisa la conexión y la configuración del despliegue.'
  }

  if (error instanceof Error && error.message.startsWith('Missing environment variable')) {
    return 'La configuración de Supabase no está completa en el despliegue.'
  }

  return 'No pudimos completar el inicio de sesión. Intenta de nuevo.'
}

export async function signInAdmin(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<void> {
  const { error } = await withTimeout(
    supabase.auth.signInWithPassword({ email: email.trim(), password }),
    'login-timeout',
  )

  if (error) throw new Error('invalid-admin-credentials')
}

export async function loadAdminOnboardingContext(
  supabase: SupabaseClient,
): Promise<AdminOnboardingContext> {
  const { data, error } = await supabase.rpc('get_my_onboarding_context')
  if (error) throw new Error(error.message || 'No se pudo cargar el primer acceso.')
  return data as AdminOnboardingContext
}

export async function loadAdminEntryContext(
  supabase: SupabaseClient,
): Promise<AdminEntryContext> {
  const { data, error } = await supabase.rpc('get_my_admin_entry_context')
  if (error) throw new Error(error.message || 'No se pudo validar el acceso administrativo.')
  return data as AdminEntryContext
}

export async function resolveAdminEntryPath(
  supabase: SupabaseClient,
  requestedPath: string,
) {
  const context = await loadAdminEntryContext(supabase)
  if (context.access_state === 'ready') return requestedPath
  if (context.access_state === 'onboarding') return '/admin/onboarding'
  return '/admin/acceso'
}

export async function signOutAdmin(supabase: SupabaseClient) {
  await supabase.auth.signOut({ scope: 'local' })
}

export async function saveAdminOnboarding(
  supabase: SupabaseClient,
  input: { fullName: string; phone: string; password?: string; complete: boolean },
): Promise<AdminOnboardingContext> {
  if (input.password) {
    const { error: passwordError } = await supabase.auth.updateUser({ password: input.password })
    if (passwordError) throw new Error(passwordError.message || 'No se pudo establecer la contraseña.')
  }

  const { data, error } = await supabase.rpc('save_my_onboarding', {
    payload: {
      full_name: input.fullName.trim(),
      phone: input.phone.trim() || null,
      complete: input.complete,
    },
  })
  if (error) throw new Error(error.message || 'No se pudo guardar el primer acceso.')
  return data as AdminOnboardingContext
}

export async function requestAdminAccessReset(email: string): Promise<void> {
  const response = await fetch('/api/admin/users/reset-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  })
  const result = await response.json().catch(() => ({})) as ResetAccessResponse
  if (!response.ok) throw new Error(result.error ?? 'No se pudo reenviar acceso.')
}

export async function requestOwnPasswordRecovery(
  supabase: SupabaseClient,
  email: string,
  origin: string,
): Promise<void> {
  const redirectTo = new URL('/admin/recuperar', origin).toString()
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
  if (error) throw new Error('No se pudo iniciar la recuperación. Intenta de nuevo más tarde.')
}

export async function waitForPasswordRecoverySession(
  supabase: SupabaseClient,
): Promise<void> {
  const { data, error } = await supabase.auth.getSession()
  if (!error && data.session) return

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      reject(new Error('recovery-session-missing'))
    }, RECOVERY_SESSION_TIMEOUT_MS)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || !['PASSWORD_RECOVERY', 'SIGNED_IN'].includes(event)) return
      clearTimeout(timeout)
      subscription.unsubscribe()
      resolve()
    })
  })
}

export async function updateRecoveredPassword(
  supabase: SupabaseClient,
  password: string,
): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(error.message || 'No se pudo actualizar la contraseña.')
  await supabase.auth.signOut({ scope: 'local' })
}
