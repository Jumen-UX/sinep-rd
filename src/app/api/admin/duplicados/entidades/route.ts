import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess()
    if (!auth.ok) return auth.response

    const payload = await request.json()
    const { data, error } = await auth.supabase.rpc('admin_find_similar_ecclesiastical_entities', { payload })

    if (error) {
      console.error('Failed to find similar ecclesiastical entities', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudieron buscar posibles duplicados.') }, { status: 400 })
    }

    return NextResponse.json({ items: data ?? [] })
  } catch (error) {
    console.error('Unexpected duplicate entity lookup API error', error)
    return NextResponse.json({ error: 'No se pudieron buscar posibles duplicados.' }, { status: 500 })
  }
}
