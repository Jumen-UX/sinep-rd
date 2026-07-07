import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type InvitePayload = {
  email?: string
  full_name?: string
  phone?: string
  role_id?: string
  role_key?: string
  scope_type?: string
  scope_entity_id?: string
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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

  const { data: canManageUsers, error: permissionError } = await supabase.rpc('current_user_has_permission', {
    p_permission_key: 'users.manage',
  })

  if (permissionError || canManageUsers !== true) {
    const { data: isSuperOrNational } = await supabase.rpc('current_user_is_super_or_national')

    if (isSuperOrNational !== true) {
      return NextResponse.json({ error: 'No autorizado para invitar usuarios.' }, { status: 403 })
    }
  }

  let payload: InvitePayload

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  const email = normalizeEmail(payload.email)
  const fullName = normalizeText(payload.full_name)
  const phone = normalizeText(payload.phone)
  const roleId = normalizeText(payload.role_id)
  const roleKey = normalizeText(payload.role_key)
  const scopeType = normalizeText(payload.scope_type) || 'national'
  const scopeEntityId = normalizeText(payload.scope_entity_id)

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Correo inválido.' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const redirectTo = new URL('/admin/login', request.url).toString()

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName || email,
        source: 'sinep-admin-invite',
      },
      redirectTo,
    })

    if (inviteError || !invited.user) {
      return NextResponse.json(
        { error: inviteError?.message ?? 'No se pudo invitar el usuario.' },
        { status: 400 },
      )
    }

    const userId = invited.user.id

    await admin.from('profiles').upsert({
      id: userId,
      email,
      full_name: fullName || email,
      phone: phone || null,
      status: 'pending',
    })

    let assignment = null

    if (roleId || roleKey) {
      const { data: assignmentData, error: assignmentError } = await supabase.rpc('admin_assign_user_role', {
        payload: {
          user_id: userId,
          role_id: roleId || undefined,
          role_key: roleKey || undefined,
          scope_type: scopeType,
          scope_entity_id: scopeEntityId || undefined,
        },
      })

      if (assignmentError) {
        return NextResponse.json({
          user_id: userId,
          email,
          warning: assignmentError.message,
        }, { status: 201 })
      }

      assignment = assignmentData
    }

    return NextResponse.json({ user_id: userId, email, assignment }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado invitando usuario.'
    const status = message.includes('SUPABASE_SERVICE_ROLE_KEY') ? 500 : 400

    return NextResponse.json({ error: message }, { status })
  }
}
