import { NextRequest, NextResponse } from 'next/server'

const fallbackUrl = 'https://hrvgpceqaxujlttpimdz.supabase.co'

const listColumns = [
  'id',
  'display_name',
  'slug',
  'person_type',
  'photo_url',
  'photo_path',
  'biography_public',
  'birth_date',
  'death_date',
  'status',
  'visibility',
  'created_at',
  'updated_at'
].join(',')

const personColumns = [
  'id',
  'display_name',
  'slug',
  'person_type',
  'photo_url',
  'photo_path',
  'biography_public',
  'birth_date',
  'birth_place',
  'death_date',
  'status',
  'visibility',
  'created_at',
  'updated_at'
].join(',')

const clergyColumns = [
  'person_id',
  'display_name',
  'slug',
  'person_type',
  'photo_url',
  'photo_path',
  'biography_public',
  'person_status',
  'death_date',
  'clergy_profile_id',
  'diaconal_ordination_date',
  'priestly_ordination_date',
  'episcopal_ordination_date',
  'canonical_status',
  'incardination_entity_name',
  'incardination_entity_slug',
  'current_service_entity_name',
  'current_service_entity_slug',
  'created_at',
  'updated_at'
].join(',')

const appointmentColumns = [
  'id',
  'person_id',
  'person_name',
  'person_slug',
  'person_type',
  'office_name',
  'office_key',
  'entity_name',
  'entity_slug',
  'pastoral_entity_name',
  'pastoral_entity_slug',
  'start_date',
  'end_date',
  'is_current',
  'appointment_type',
  'status',
  'visibility',
  'notes_public'
].join(',')

const movementColumns = [
  'id',
  'person_id',
  'person_name',
  'person_slug',
  'entity_name',
  'entity_slug',
  'pastoral_entity_name',
  'pastoral_entity_slug',
  'movement_type',
  'title',
  'description',
  'effective_date',
  'end_date',
  'status',
  'visibility'
].join(',')

const episcopalOrdinationColumns = [
  'id',
  'bishop_person_id',
  'bishop_name',
  'bishop_slug',
  'ordination_date',
  'ordination_place',
  'principal_consecrator_person_name',
  'principal_consecrator_person_slug',
  'principal_consecrator_name',
  'co_consecrator_1_person_name',
  'co_consecrator_1_person_slug',
  'co_consecrator_1_name',
  'co_consecrator_2_person_name',
  'co_consecrator_2_person_slug',
  'co_consecrator_2_name',
  'source_name',
  'source_url',
  'source_checked_at',
  'verification_status',
  'notes_public'
].join(',')

function getApiKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_RJkFs3kYh4BoAzfGivOlvg_xBCEklGP'
  )
}

async function fetchJson<T>(endpoint: string, key: string): Promise<T> {
  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(details || `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl
  const key = getApiKey()
  const slug = request.nextUrl.searchParams.get('slug')

  try {
    if (!slug) {
      const people = await fetchJson<Record<string, unknown>[]>(
        `${url}/rest/v1/persons?status=eq.active&visibility=eq.public&select=${listColumns}&order=display_name.asc`,
        key
      )
      return NextResponse.json(people)
    }

    const encodedSlug = encodeURIComponent(slug)

    const people = await fetchJson<Record<string, unknown>[]>(
      `${url}/rest/v1/persons?slug=eq.${encodedSlug}&status=eq.active&visibility=eq.public&select=${personColumns}&limit=1`,
      key
    )

    const person = people[0]

    if (!person) {
      return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })
    }

    const [clergyRows, appointments, movements, episcopalOrdinations] = await Promise.all([
      fetchJson<Record<string, unknown>[]>(
        `${url}/rest/v1/public_clergy?slug=eq.${encodedSlug}&select=${clergyColumns}&limit=1`,
        key
      ).catch(() => []),
      fetchJson<Record<string, unknown>[]>(
        `${url}/rest/v1/public_current_appointments?person_slug=eq.${encodedSlug}&select=${appointmentColumns}&order=start_date.desc.nullslast`,
        key
      ).catch(() => []),
      fetchJson<Record<string, unknown>[]>(
        `${url}/rest/v1/public_person_movements?person_slug=eq.${encodedSlug}&select=${movementColumns}&order=effective_date.desc.nullslast`,
        key
      ).catch(() => []),
      fetchJson<Record<string, unknown>[]>(
        `${url}/rest/v1/public_episcopal_ordinations?bishop_slug=eq.${encodedSlug}&select=${episcopalOrdinationColumns}&limit=1`,
        key
      ).catch(() => [])
    ])

    return NextResponse.json({
      person,
      clergy: clergyRows[0] ?? null,
      appointments,
      movements,
      episcopal_ordination: episcopalOrdinations[0] ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'No se pudo cargar la información de personas',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
