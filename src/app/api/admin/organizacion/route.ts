import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { parseJsonObjectBody, ValidationError } from '@/lib/admin/validation'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'
import { revalidatePublicContent } from '@/lib/public/cache'

export async function POST(request: NextRequest) {
  try {
    const payload = await parseJsonObjectBody(request, 'Solicitud inválida.')
    const isUpdate = typeof payload.id === 'string' && payload.id.trim().length > 0
    const permissionKey = isUpdate ? 'pastorals.update_proposal' : 'pastorals.create_proposal'
    const auth = await requireAdminAccess({
      permissionKey,
      forbiddenMessage: isUpdate
        ? 'No autorizado para editar unidades organizativas.'
        : 'No autorizado para crear unidades organizativas.',
    })
    if (!auth.ok) return auth.response

    const { data, error } = await auth.supabase.rpc('admin_save_organization_unit', { payload })
    if (error) {
      console.error('Failed to save organization unit', error)
      return NextResponse.json(
        { error: toSpanishAdminError(error, 'No se pudo guardar la unidad organizativa.') },
        { status: 400 },
      )
    }

    revalidatePublicContent()
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected organization unit admin API error', error)
    return NextResponse.json({ error: 'No se pudo guardar la unidad organizativa.' }, { status: 500 })
  }
}
