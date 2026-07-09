import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type EnableCountryResponse = string | { id?: string; country_id?: string } | null

function normalizeIso2(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().toUpperCase()
}

function optionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const [enabledCountries, publicCountries] = await Promise.all([
      supabase
        .from('countries')
        .select('id,iso2,iso3,name,official_name,flag_emoji,flag_image_url,flag_alt,status,visibility,created_at,updated_at')
        .order('name'),
      supabase
        .from('public_countries')
        .select('key,iso2,name,flag_emoji,flag_image_url')
        .order('name'),
    ])

    if (enabledCountries.error) {
      return NextResponse.json({ error: enabledCountries.error.message }, { status: 400 })
    }

    if (publicCountries.error) {
      return NextResponse.json({ error: publicCountries.error.message }, { status: 400 })
    }

    return NextResponse.json({
      enabled_countries: enabledCountries.data ?? [],
      public_countries: publicCountries.data ?? [],
    })
  } catch (error) {
    console.error('Unexpected admin countries API error', error)
    return NextResponse.json({ error: 'No se pudieron cargar los países.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const payload = await request.json()
    const iso2 = normalizeIso2(payload.iso2)
    const flagImageUrl = optionalText(payload.flag_image_url)

    if (!/^[A-Z]{2}$/.test(iso2)) {
      return NextResponse.json({ error: 'Selecciona un país válido del catálogo ISO.' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('enable_country_from_catalog', {
      p_iso2: iso2,
      p_flag_image_url: flagImageUrl,
    })

    if (error) {
      console.error('Failed to enable country from catalog', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const saved = data as EnableCountryResponse
    const countryId = typeof saved === 'string' ? saved : (saved?.country_id ?? saved?.id ?? null)

    return NextResponse.json({ country_id: countryId, iso2 })
  } catch (error) {
    console.error('Unexpected enable country API error', error)
    return NextResponse.json({ error: 'No se pudo habilitar el país.' }, { status: 500 })
  }
}
