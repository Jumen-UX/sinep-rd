Exit code: 0
Wall time: 0.4 seconds
Output:
import type { SupabaseClient } from '@supabase/supabase-js'

const LOGIN_TIMEOUT_MS = 15_000

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
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/admin'
  return next
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

export async function resolveAdminEntryPath(
  supabase: SupabaseClient,
  requestedPath: string,
) {
  const context = await loadAdminOnboardingContext(supabase)
  return context.onboarding_completed_at ? requestedPath : '/admin/onboarding'
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

