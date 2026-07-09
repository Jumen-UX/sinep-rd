import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type RequireAdminAccessOptions = {
  permissionKey?: string
  allowSuperOrNational?: boolean
  forbiddenMessage?: string
  unauthenticatedMessage?: string
}

type AdminAccessResult =
  | { ok: true; supabase: SupabaseServerClient; user: User }
  | { ok: false; response: NextResponse }

export async function requireAdminAccess(options: RequireAdminAccessOptions = {}): Promise<AdminAccessResult> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError || !userData.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: options.unauthenticatedMessage ?? 'No autorizado' },
        { status: 401 },
      ),
    }
  }

  const { data: hasAdminRole, error: roleError } = await supabase.rpc('current_user_has_admin_role')

  if (roleError) {
    console.error('Failed to validate admin role', roleError)
    return {
      ok: false,
      response: NextResponse.json({ error: 'No se pudo validar el rol administrativo.' }, { status: 403 }),
    }
  }

  if (hasAdminRole !== true) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: options.forbiddenMessage ?? 'No tienes un rol administrativo activo.' },
        { status: 403 },
      ),
    }
  }

  if (options.permissionKey) {
    const [permissionResult, superAdminResult] = await Promise.all([
      supabase.rpc('current_user_has_permission', { p_permission_key: options.permissionKey }),
      options.allowSuperOrNational === false
        ? Promise.resolve({ data: false, error: null })
        : supabase.rpc('current_user_is_super_or_national'),
    ])

    if (permissionResult.error || superAdminResult.error) {
      console.error('Failed to validate admin permission', {
        permissionKey: options.permissionKey,
        permissionError: permissionResult.error,
        superAdminError: superAdminResult.error,
      })
      return {
        ok: false,
        response: NextResponse.json({ error: 'No se pudo validar el permiso administrativo.' }, { status: 403 }),
      }
    }

    if (permissionResult.data !== true && superAdminResult.data !== true) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: options.forbiddenMessage ?? 'No autorizado para realizar esta acción.' },
          { status: 403 },
        ),
      }
    }
  }

  return { ok: true, supabase, user: userData.user }
}
