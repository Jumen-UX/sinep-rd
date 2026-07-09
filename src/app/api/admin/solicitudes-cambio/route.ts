import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess()
    if (!auth.ok) return auth.response

    const payload = await request.json()
    const { data, error } = await auth.supabase.rpc('admin_review_change_request', { payload })

    if (error) {
      console.error('Failed to review change request', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected change request review API error', error)
    return NextResponse.json({ error: 'No se pudo revisar la solicitud' }, { status: 500 })
  }
}
