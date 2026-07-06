import { NextRequest, NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

const columns = [
  'id',
  'slug',
  'name',
  'entity_type_name',
  'ecclesiastical_province_name',
  'province',
  'municipality',
  'latin_name',
  'cathedral_name',
  'current_ordinary_name',
  'current_ordinary_title',
  'territory_summary',
  'area_km2',
  'statistics_year',
  'population_total',
  'catholics_total',
  'catholics_percent',
  'parishes_count',
  'source_name',
  'source_url',
  'source_checked_at',
  'erected_at'
].join(',')

function buildFilters(request: NextRequest) {
  const tipo = request.nextUrl.searchParams.get('tipo')
  const provincia = request.nextUrl.searchParams.get('provincia')
  const limit = request.nextUrl.searchParams.get('limit')
  const filters: Record<string, string | string[]> = {
    select: columns,
    order: 'name.asc',
  }

  if (provincia) {
    filters.ecclesiastical_province_name = `eq.${provincia}`
  }

  if (tipo === 'archdiocese') {
    filters.or = '(entity_type_name.ilike.*arquidiócesis*,entity_type_name.ilike.*arquidiocesis*)'
  }

  if (tipo === 'diocese') {
    filters.entity_type_name = ['ilike.*diócesis*', 'not.ilike.*arquidiócesis*']
  }

  if (tipo === 'military') {
    filters.or = '(entity_type_name.ilike.*castrense*,entity_type_name.ilike.*militar*,name.ilike.*castrense*,name.ilike.*militar*)'
  }

  if (limit && /^\d+$/.test(limit)) {
    filters.limit = limit
  }

  return filters
}

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSupabaseJson<Record<string, unknown>[]>('public_dioceses', buildFilters(request))
    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected dioceses API error', error)
    return NextResponse.json({ error: 'No se pudo cargar el directorio' }, { status: 500 })
  }
}
