import { NextResponse } from 'next/server'

const columns = [
  'id',
  'name',
  'entity_type_name',
  'ecclesiastical_province_name',
  'province',
  'municipality'
].join(',')

function getEnv(name: string, fallback: string) {
  return process.env[name] || fallback
}

export async function GET() {
  const url = getEnv(
    'NEXT_PUBLIC_SUPABASE_URL',
    'https://hrvgpceqaxujlttpimdz.supabase.co'
  )
  const key = getEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'sb_publishable_RJkFs3kYh4BoAzfGivOlvg_xBCEklGP'
  )
  const table = ['public', 'dioceses'].join('_')
  const endpoint = `${url}/rest/v1/${table}?select=${columns}&order=name.asc`

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
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
