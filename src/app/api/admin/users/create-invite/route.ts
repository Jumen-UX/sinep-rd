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
  country_entity_id?: string
  role_id?: string
  role_key?: string
  scope_type?: string
  scope_entity_id?: string
}

type ValidatedCountry = {
  country_entity_id: string
  country_iso2: string
  country_name: string
}

type ValidatedAccess = {
  role_id: string
  role_key: string
  role_name: string
  scope_type: string
  scope_entity_id: string | null
  scope_label: string
  country_iso2: string | null
}

type ReconciledInvitation = {
  user_id: string
  email: string
  profile_existed: boolean
  membership: unknown
  assignment: unknown
}

export async function POST(request: Request) {
  const auth = await requireAdminAccess({
    permissionKey: 'users.manage',
    unauthenticatedMessage: 'No autenticado.',
    forbiddenMessage: 'No autorizado para invitar usuarios.',
  })

  if (!auth.ok) return auth.response

  try {
    const payload = await parseJsonObjectBody(request, 'Solicitud inválida.') as Payload
    const email = requiredEmail(payload.email)
    const fullName = optionalText(payload.full_name, 180)
    const phone = optionalText(payload.phone, 80)
    const countryEntityId = optionalText(payload.country_entity_id, 36)
    const roleId = optionalText(payload.role_id, 36)
    const roleKey = optionalText(payload.role_key, 80)
    const scopeType = optionalText(payload.scope_type, 80) || 'national'
    const scopeEntityId = optionalText(payload.scope_entity_id, 36)

    if (!countryEntityId) {
      return NextResponse.json({ error: 'Debes seleccionar el país administrativo.' }, { status: 400 })
    }

    const { data: countryData, error: countryError } = await auth.supabase.rpc('validate_admin_country_scope', {
      payload: { country_entity_id: countryEntityId },
    })

    if (countryError) {
      return NextResponse.json({
        error: countryError.message || 'El país administrativo seleccionado no es válido.',
      }, { status: 400 })
    }

    const validatedCountry = countryData as ValidatedCountry
    let validatedAccess: ValidatedAccess | null = null

    if (roleId || roleKey) {
      const { data, error } = await auth.supabase.rpc('validate_admin_role_scope', {
        payload: {
          role_id: roleId || undefined,
          role_key: roleKey || undefined,
          scope_type: scopeType,
          scope_entity_id: scopeEntityId || undefined,
        },
      })

      if (error) {
        return NextResponse.json({
          error: error.message || 'El rol o alcance seleccionado no es válido.',
        }, { status: 400 })
      }

      validatedAccess = data as ValidatedAccess

      if (validatedAccess.country_iso2 && validatedAccess.country_iso2 !== validatedCountry.country_iso2) {
        return NextResponse.json({
          error: `El alcance del rol pertenece a ${validatedAccess.country_iso2}, pero la cuenta fue asignada a ${validatedCountry.country_iso2}.`,
        }, { status: 400 })
      }
    }

    const admin = createAdminClient()
    const redirectTo = new URL('/admin/onboarding', getAppBaseUrl()).toString()
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName || email,
        source: 'sinep-admin-invite',
      },
      redirectTo,
    })

    const inviteCreated = !inviteError && Boolean(inviteData.user?.id)
    const { data: reconciliationData, error: reconciliationError } = await auth.supabase.rpc(
      'admin_reconcile_user_invitation',
      {
        payload: {
          user_id_hint: inviteData.user?.id || undefined,
          email,
          full_name: fullName || undefined,
          phone: phone || undefined,
          country_entity_id: validatedCountry.country_entity_id,
          role_id: validatedAccess?.role_id || undefined,
          role_key: validatedAccess?.role_key || undefined,
          scope_type: validatedAccess?.scope_type || undefined,
          scope_entity_id: validatedAccess?.scope_entity_id || undefined,
        },
      },
    )

    const reconciliation = reconciliationData as ReconciledInvitation | null
    const userId = reconciliation?.user_id ?? inviteData.user?.id ?? null
    const existingUser = !inviteCreated

    if (reconciliationError || !reconciliation || !userId) {
      await recordAdminAudit(auth.supabase, {
        action: 'users.invite',
        targetTable: 'profiles',
        targetId: userId,
        metadata: {
          email_domain: emailDomain(email),
          invite_created: inviteCreated,
          invite_error: inviteError?.message ?? null,
          reconciliation_error: reconciliationError?.message ?? null,
          country_entity_id: validatedCountry.country_entity_id,
          country_iso2: validatedCountry.country_iso2,
        },
      })

      return NextResponse.json({
        error: inviteCreated
          ? 'La invitación fue enviada, pero su configuración quedó pendiente. Puedes reintentar sin crear otra cuenta.'
          : inviteError?.message || reconciliationError?.message || 'No se pudo invitar el usuario.',
        recoverable: inviteCreated,
      }, { status: inviteCreated ? 500 : 400 })
    }

    await recordAdminAudit(auth.supabase, {
      action: 'users.invite',
      targetTable: 'profiles',
      targetId: userId,
      metadata: {
        email_domain: emailDomain(email),
        existing_user: existingUser,
        invite_created: inviteCreated,
        onboarding_state: existingUser ? 'existing_user' : 'pending_invitation',
        country_entity_id: validatedCountry.country_entity_id,
        country_iso2: validatedCountry.country_iso2,
        role_assigned: Boolean(reconciliation.assignment),
        role_id: validatedAccess?.role_id ?? null,
        scope_type: validatedAccess?.scope_type ?? null,
        scope_entity_id: validatedAccess?.scope_entity_id ?? null,
      },
    })

    return NextResponse.json({
      user_id: userId,
      email,
      existing_user: existingUser,
      membership: reconciliation.membership,
      assignment: reconciliation.assignment,
      country_preview: validatedCountry,
      access_preview: validatedAccess,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    const message = error instanceof Error ? error.message : 'Error inesperado invitando usuario.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
