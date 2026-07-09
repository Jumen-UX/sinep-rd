import { NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { getAppBaseUrl } from '@/lib/appBaseUrl'
import { createAdminClient } from '@/lib/supabase/admin'

type Payload = {
  email?: string
  full_name?: string
  phone?: string
  role_id?: string
  role_key?: string
  scope_type?: string
  scope_entity_id?: string
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function emailText(value: unknown) {
  return text(value).toLowerCase()
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: Request) {
  const auth = await requireAdminAccess({
    permissionKey: 'users.manage',
    unauthenticatedMessage: 'No autenticado.',
    forbiddenMessage: 'No autorizado para invitar usuarios.',
  })

  if (!auth.ok) return auth.response

  let payload: Payload

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const email = emailText(payload.email)
  const fullName = text(payload.full_name)
  const phone = text(payload.phone)
  const roleId = text(payload.role_id)
  const roleKey = text(payload.role_key)
  const scopeType = text(payload.scope_type) || 'national'
  const scopeEntityId = text(payload.scope_entity_id)

  if (!validEmail(email)) {
    return NextResponse.json({ error: 'Correo inválido.' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const redirectTo = new URL('/admin/login', getAppBaseUrl()).toString()
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName || email,
        source: 'sinep-admin-invite',
      },
      redirectTo,
    })

    let userId = inviteData.user?.id ?? null
    let existingUser = false

    if (inviteError || !userId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle()

      userId = typeof profile?.id === 'string' ? profile.id : null
      existingUser = Boolean(userId)
    }

    if (!userId) {
      return NextResponse.json({ error: inviteError?.message ?? 'No se pudo invitar el usuario.' }, { status: 400 })
    }

    if (existingUser) {
      await admin
        .from('profiles')
        .update({ email, full_name: fullName || email, phone: phone || null })
        .eq('id', userId)
    } else {
      await admin.from('profiles').upsert({
        id: userId,
        email,
        full_name: fullName || email,
        phone: phone || null,
        status: 'pending',
      })
    }

    let assignment = null

    if (roleId || roleKey) {
      const { data, error } = await auth.supabase.rpc('admin_assign_user_role', {
        payload: {
          user_id: userId,
          role_id: roleId || undefined,
          role_key: roleKey || undefined,
          scope_type: scopeType,
          scope_entity_id: scopeEntityId || undefined,
        },
      })

      if (error) {
        return NextResponse.json({ user_id: userId, email, existing_user: existingUser, warning: error.message }, { status: 201 })
      }

      assignment = data
    }

    return NextResponse.json({ user_id: userId, email, existing_user: existingUser, assignment }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado invitando usuario.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
