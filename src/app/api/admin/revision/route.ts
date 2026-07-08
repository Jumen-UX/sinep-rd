import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('admin_review_queue', { payload: { limit: 120 } })

    if (error) {
      console.error('Failed to load admin review queue', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo cargar la cola de revisión.') }, { status: 400 })
    }

    return NextResponse.json({ items: data ?? [] })
  } catch (error) {
    console.error('Unexpected admin review queue API error', error)
    return NextResponse.json({ error: 'No se pudo cargar la cola de revisión.' }, { status: 500 })
  }
}
