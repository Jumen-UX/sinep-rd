import { NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { getAppBaseUrl } from '@/lib/appBaseUrl'
import { createAdminClient } from '@/lib/supabase/admin'

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: Request) {
  const auth = await requireAdminAccess({
    permissionKey: 'users.manage',
    unauthenticatedMessage: 'No autenticado.',
    forbiddenMessage: 'No autorizado para reenviar acceso.',
  })

  if (!auth.ok) return auth.response

  let payload: { email?: string }

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const email = normalizeEmail(payload.email)

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Correo inválido.' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const redirectTo = new URL('/admin/login', getAppBaseUrl()).toString()
    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ email, sent: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo reenviar acceso.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
