import { NextRequest, NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

type DioceseRow = {
  id: string
  slug: string
  name: string
  entity_type_name: string | null
  ecclesiastical_province_name: string | null
  current_ordinary_name: string | null
  current_ordinary_title: string | null
  population_total: number | null
  catholics_total: number | null
  parishes_count: number | null
  territory_summary: string | null
  statistics_year: number | null
}

function normalizeText(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function isArchdiocese(item: DioceseRow) {
  return normalizeText(item.entity_type_name).includes('arquidiocesis')
}

export async function GET(request: NextRequest) {
  const requestedSlug = request.nextUrl.searchParams.get('slug')

  if (!requestedSlug) {
    return NextResponse.json({ error: 'Falta el identificador de la provincia eclesiástica' }, { status: 400 })
  }

  try {
    const dioceses = await fetchSupabaseJson<DioceseRow[]>('public_dioceses', {
      select: 'id,slug,name,entity_type_name,ecclesiastical_province_name,current_ordinary_name,current_ordinary_title,population_total,catholics_total,parishes_count,territory_summary,statistics_year',
      order: 'name.asc',
    })

    const jurisdictions = dioceses.filter((item) => item.ecclesiastical_province_name && slugify(item.ecclesiastical_province_name) === requestedSlug)
    const name = jurisdictions[0]?.ecclesiastical_province_name ?? null

    if (!name) {
      return NextResponse.json({ error: 'Provincia eclesiástica no encontrada' }, { status: 404 })
    }

    const metropolitanSee = jurisdictions.find(isArchdiocese) ?? jurisdictions[0]

    return NextResponse.json({
      province: {
        name,
        slug: requestedSlug,
        country_name: 'República Dominicana',
        metropolitan_see: metropolitanSee,
        current_metropolitan_name: metropolitanSee?.current_ordinary_name ?? null,
        current_metropolitan_title: metropolitanSee?.current_ordinary_title ?? null,
        jurisdiction_count: jurisdictions.length,
        total_population: jurisdictions.reduce((sum, item) => sum + (item.population_total ?? 0), 0),
        total_catholics: jurisdictions.reduce((sum, item) => sum + (item.catholics_total ?? 0), 0),
        reported_parishes: jurisdictions.reduce((sum, item) => sum + (item.parishes_count ?? 0), 0),
      },
      jurisdictions,
    })
  } catch (error) {
    console.error('Unexpected ecclesiastical province API error', error)
    return NextResponse.json({ error: 'No se pudo cargar la provincia eclesiástica' }, { status: 500 })
  }
}
