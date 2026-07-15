import { NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { emailDomain, parseJsonObjectBody, requiredEmail, ValidationError } from '@/lib/admin/validation'
import { getAppBaseUrl } from '@/lib/appBaseUrl'
import { createAdminClient } from '@/lib/supabase/admin'

type Payload = {
  email?: string
}

export async function POST(request: Request) {
  const auth = await requireAdminAccess({
    permissionKey: 'users.manage',
    unauthenticatedMessage: 'No autenticado.',
    forbiddenMessage: 'No autorizado para reenviar acceso.',
  })

  if (!auth.ok) return auth.response

  try {
    const payload = await parseJsonObjectBody(request, 'Solicitud invalida.') as Payload
    const email = requiredEmail(payload.email)

    const admin = createAdminClient()
    const redirectTo = new URL('/admin/recuperar', getAppBaseUrl()).toString()
    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await recordAdminAudit(auth.supabase, {
      action: 'users.reset_access',
      targetTable: 'profiles',
      metadata: {
        email_domain: emailDomain(email),
      },
    })

    return NextResponse.json({ email, sent: true })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    const message = error instanceof Error ? error.message : 'No se pudo reenviar acceso.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

