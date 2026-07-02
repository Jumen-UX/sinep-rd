import { NextResponse } from 'next/server'

const columns = [
  'id',
  'name',
  'entity_type_name',
  'ecclesiastical_province_name',
  'province',
  'municipality'
].join(',')

function getEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

export async function GET() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
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
    return NextResponse.json(
      { error: 'No se pudo cargar el directorio' },
      { status: response.status }
    )
  }

  const data = await response.json()
  return NextResponse.json(data)
}
