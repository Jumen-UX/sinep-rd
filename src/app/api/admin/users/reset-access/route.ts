import { NextResponse } from 'next/server'
import { getAppBaseUrl } from '@/lib/appBaseUrl'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })
  }

  const { data: canManage } = await supabase.rpc('current_user_has_permission', {
    p_permission_key: 'users.manage',
  })
  const { data: canAdmin } = await supabase.rpc('current_user_is_super_or_national')

  if (canManage !== true && canAdmin !== true) {
    return NextResponse.json({ error: 'No autorizado para reenviar acceso.' }, { status: 403 })
  }

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
