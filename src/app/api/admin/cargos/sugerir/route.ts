import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess()
    if (!auth.ok) return auth.response

    const payload = await request.json()
    const { data, error } = await auth.supabase.rpc('editor_suggest_office_configuration', { payload })

    if (error) {
      console.error('Failed to submit office configuration suggestion', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected office suggestion API error', error)
    return NextResponse.json({ error: 'No se pudo enviar la sugerencia de cargo' }, { status: 500 })
  }
}
