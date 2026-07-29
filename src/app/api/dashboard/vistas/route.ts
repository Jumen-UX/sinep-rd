import { NextResponse } from 'next/server'
import { loadPublicDashboardBundle } from '@/lib/public/dashboard'

export async function GET() {
  try {
    return NextResponse.json(await loadPublicDashboardBundle())
  } catch (error) {
    console.error('Unexpected public dashboard views API error', error)
    return NextResponse.json({ error: 'No se pudieron cargar las vistas públicas' }, { status: 500 })
  }
}
