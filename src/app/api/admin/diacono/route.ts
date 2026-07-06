import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const payload = await request.json()
    const { data, error } = await supabase.rpc('admin_save_deacon', { payload })

    if (error) {
      console.error('Failed to save deacon transactionally', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected deacon admin API error', error)
    return NextResponse.json({ error: 'No se pudo guardar el diácono' }, { status: 500 })
  }
}
