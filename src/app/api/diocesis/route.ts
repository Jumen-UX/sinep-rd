import { NextRequest, NextResponse } from 'next/server'
import { loadDioceseDirectory, normalizeDioceseFilter } from '@/lib/public/directories'

export async function GET(request: NextRequest) {
  const tipo = normalizeDioceseFilter(request.nextUrl.searchParams.get('tipo'))
  const provincia = request.nextUrl.searchParams.get('provincia')
  const limitValue = request.nextUrl.searchParams.get('limit')
  const limit = limitValue && /^\d+$/.test(limitValue) ? Number(limitValue) : undefined

  try {
    return NextResponse.json(await loadDioceseDirectory(tipo, provincia, limit))
  } catch (error) {
    console.error('Unexpected dioceses API error', error)
    return NextResponse.json({ error: 'No se pudo cargar el directorio' }, { status: 500 })
  }
}
