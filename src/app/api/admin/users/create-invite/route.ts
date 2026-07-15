Exit code: 0
Wall time: 0.4 seconds
Output:
import { NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { emailDomain, optionalText, parseJsonObjectBody, requiredEmail, ValidationError } from '@/lib/admin/validation'
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

export async function POST(request: Request) {
  const auth = await requireAdminAccess({
    permissionKey: 'users.manage',
    unauthenticatedMessage: 'No autenticado.',
    forbiddenMessage: 'No autorizado para invitar usuarios.',
  })

  if (!auth.ok) return auth.response

  try {
    const payload = await parseJsonObjectBody(request, 'Solicitud invalida.') as Payload
    const email = requiredEmail(payload.email)
    const fullName = optionalText(payload.full_name, 180)
    const phone = optionalText(payload.phone, 80)
    const roleId = optionalText(payload.role_id, 36)
    const roleKey = optionalText(payload.role_key, 80)
    const scopeType = optionalText(payload.scope_type, 80) || 'national'
    const scopeEntityId = optionalText(payload.scope_entity_id, 36)

    const admin = createAdminClient()
    const redirectTo = new URL('/admin/onboarding', getAppBaseUrl()).toString()
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
        await recordAdminAudit(auth.supabase, {
          action: 'users.invite',
          targetTable: 'profiles',
          targetId: userId,
          metadata: {
            email_domain: emailDomain(email),
            existing_user: existingUser,
            role_assignment_warning: error.message,
          },
        })

        return NextResponse.json({ user_id: userId, email, existing_user: existingUser, warning: error.message }, { status: 201 })
      }

      assignment = data
    }

    await recordAdminAudit(auth.supabase, {
      action: 'users.invite',
      targetTable: 'profiles',
      targetId: userId,
      metadata: {
        email_domain: emailDomain(email),
        existing_user: existingUser,
        role_assigned: Boolean(roleId || roleKey),
        scope_type: scopeType,
      },
    })

    return NextResponse.json({ user_id: userId, email, existing_user: existingUser, assignment }, { status: 201 })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    const message = error instanceof Error ? error.message : 'Error inesperado invitando usuario.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

