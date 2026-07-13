import { NextResponse } from 'next/server'
import { loadDashboardSummary } from '@/lib/public/dashboard'

export async function GET() {
  try {
    return NextResponse.json(await loadDashboardSummary())
  } catch (error) {
    console.error('Unexpected dashboard summary API error', error)
    return NextResponse.json({ error: 'No se pudo cargar el resumen del dashboard' }, { status: 500 })
  }
}
