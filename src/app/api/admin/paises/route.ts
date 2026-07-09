import { NextRequest, NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { parseJsonObjectBody, ValidationError } from '@/lib/admin/validation'

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
    const auth = await requireAdminAccess()
    if (!auth.ok) return auth.response

    const [enabledCountries, publicCountries] = await Promise.all([
      auth.supabase
        .from('countries')
        .select('id,iso2,iso3,name,official_name,flag_emoji,flag_image_url,flag_alt,status,visibility,created_at,updated_at')
        .order('name'),
      auth.supabase
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
    return NextResponse.json({ error: 'No se pudieron cargar los paises.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess()
    if (!auth.ok) return auth.response

    const payload = await parseJsonObjectBody(request, 'Solicitud invalida.')
    const iso2 = normalizeIso2(payload.iso2)
    const flagImageUrl = optionalText(payload.flag_image_url)

    if (!/^[A-Z]{2}$/.test(iso2)) {
      return NextResponse.json({ error: 'Selecciona un pais valido del catalogo ISO.' }, { status: 400 })
    }

    const { data, error } = await auth.supabase.rpc('enable_country_from_catalog', {
      p_iso2: iso2,
      p_flag_image_url: flagImageUrl,
    })

    if (error) {
      console.error('Failed to enable country from catalog', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const saved = data as EnableCountryResponse
    const countryId = typeof saved === 'string' ? saved : (saved?.country_id ?? saved?.id ?? null)

    await recordAdminAudit(auth.supabase, {
      action: 'countries.enable',
      targetTable: 'countries',
      targetId: countryId,
      metadata: { iso2 },
    })

    return NextResponse.json({ country_id: countryId, iso2 })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected enable country API error', error)
    return NextResponse.json({ error: 'No se pudo habilitar el pais.' }, { status: 500 })
  }
}
