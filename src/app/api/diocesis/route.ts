import { NextResponse } from 'next/server'
import { getSupabaseRestHeaders, getSupabaseUrl } from '@/lib/supabase/config'

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

export async function GET() {
  try {
    const url = getSupabaseUrl()
    const table = ['public', 'dioceses'].join('_')
    const endpoint = `${url}/rest/v1/${table}?select=${columns}&order=name.asc`

    const response = await fetch(endpoint, {
      headers: getSupabaseRestHeaders(),
      cache: 'no-store',
    })

    if (!response.ok) {
      const details = await response.text()
      console.error('Failed to load dioceses from Supabase', {
        status: response.status,
        details,
      })

      return NextResponse.json(
        { error: 'No se pudo cargar el directorio' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected dioceses API error', error)
    return NextResponse.json({ error: 'No se pudo cargar el directorio' }, { status: 500 })
  }
}
