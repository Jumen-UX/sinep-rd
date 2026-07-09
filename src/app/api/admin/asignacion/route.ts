import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess()
    if (!auth.ok) return auth.response

    const payload = await request.json()
    const { data, error } = await auth.supabase.rpc('admin_save_position_assignment', { payload })

    if (error) {
      console.error('Failed to save position assignment transactionally', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo guardar la asignación.') }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected position assignment admin API error', error)
    return NextResponse.json({ error: 'No se pudo guardar la asignación' }, { status: 500 })
  }
}
