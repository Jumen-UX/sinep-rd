import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const payload = await request.json()
    const { data, error } = await supabase.rpc('admin_find_similar_ecclesiastical_entities', { payload })

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
