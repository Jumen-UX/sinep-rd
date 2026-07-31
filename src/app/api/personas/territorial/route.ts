import { NextRequest, NextResponse } from 'next/server'
import { loadPersonTerritorialAssignments } from '@/lib/public/directories'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const countryPattern = /^[A-Z]{2}$/
const personTypes = new Set(['bishop', 'priest', 'deacon', 'religious', 'layperson'])

export async function GET(request: NextRequest) {
  const countryIso2 = request.nextUrl.searchParams.get('pais')?.toUpperCase() ?? null
  const dioceseId = request.nextUrl.searchParams.get('diocesis')
  const parishId = request.nextUrl.searchParams.get('parroquia')
  const requestedPersonType = request.nextUrl.searchParams.get('tipo')
  const limitValue = request.nextUrl.searchParams.get('limit')
  const limit = limitValue && /^\d+$/.test(limitValue) ? Math.min(Number(limitValue), 200) : undefined

  if (countryIso2 && !countryPattern.test(countryIso2)) {
    return NextResponse.json({ error: 'El país debe usar un código ISO de dos letras.' }, { status: 400 })
  }
  if (dioceseId && !uuidPattern.test(dioceseId)) {
    return NextResponse.json({ error: 'La diócesis indicada no es válida.' }, { status: 400 })
  }
  if (parishId && !uuidPattern.test(parishId)) {
    return NextResponse.json({ error: 'La parroquia indicada no es válida.' }, { status: 400 })
  }
  if (requestedPersonType && !personTypes.has(requestedPersonType)) {
    return NextResponse.json({ error: 'El tipo de persona indicado no es válido.' }, { status: 400 })
  }

  try {
    const assignments = await loadPersonTerritorialAssignments({
      countryIso2,
      dioceseId,
      parishId,
      personType: requestedPersonType,
      limit,
    })

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Unexpected territorial people directory error', error)
    return NextResponse.json({ error: 'No se pudo cargar el directorio territorial de personas.' }, { status: 500 })
  }
}
