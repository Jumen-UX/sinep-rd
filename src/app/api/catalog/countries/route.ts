import { NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

type CountryCatalogRow = {
  key: string
  iso2: string
  iso3: string | null
  name: string
  name_en: string
  official_name_en: string | null
  common_name_en: string | null
  flag_emoji: string | null
  flag_alt: string | null
}

export async function GET() {
  try {
    const countries = await fetchSupabaseJson<CountryCatalogRow[]>('public_country_catalog', {
      select: 'key,iso2,iso3,name,name_en,official_name_en,common_name_en,flag_emoji,flag_alt',
      order: 'name.asc',
    })

    return NextResponse.json({ countries })
  } catch (error) {
    console.error('Country catalog API error', error)
    return NextResponse.json({ error: 'No se pudo cargar el catálogo de países' }, { status: 500 })
  }
}
