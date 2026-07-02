import { NextResponse } from 'next/server'

const columns = [
  'id',
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

const fallbackUrl = 'https://hrvgpceqaxujlttpimdz.supabase.co'

function getApiKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_RJkFs3kYh4BoAzfGivOlvg_xBCEklGP'
  )
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl
  const key = getApiKey()
  const table = ['public', 'dioceses'].join('_')
  const endpoint = `${url}/rest/v1/${table}?select=${columns}&order=name.asc`

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const details = await response.text()
    return NextResponse.json(
      { error: 'No se pudo cargar el directorio', status: response.status, details },
      { status: response.status }
    )
  }

  const data = await response.json()
  return NextResponse.json(data)
}
