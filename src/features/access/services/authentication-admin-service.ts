import type { SupabaseClient } from '@supabase/supabase-js'

const LOGIN_TIMEOUT_MS = 15_000

type ResetAccessResponse = {
  error?: string
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

export async function requestAdminAccessReset(email: string): Promise<void> {
  const response = await fetch('/api/admin/users/reset-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  })
  const result = await response.json().catch(() => ({})) as ResetAccessResponse
  if (!response.ok) throw new Error(result.error ?? 'No se pudo reenviar acceso.')
}
