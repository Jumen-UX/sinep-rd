import { NextRequest, NextResponse } from 'next/server'

const fallbackUrl = 'https://hrvgpceqaxujlttpimdz.supabase.co'

const entityColumns = [
  'id',
  'entity_type_id',
  'name',
  'official_name',
  'slug',
  'description',
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
  'country',
  'province',
  'municipality',
  'sector',
  'address',
  'email',
  'phone',
  'website',
  'facebook_url',
  'instagram_url',
  'youtube_url',
  'status',
  'visibility',
  'erected_at',
  'created_at',
  'updated_at'
].join(',')

const relationshipColumns = [
  'id',
  'parent_entity_id',
  'child_entity_id',
  'relationship_type',
  'start_date',
  'end_date',
  'is_current',
  'status',
  'notes',
  'created_at'
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
  const slug = request.nextUrl.searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'Falta el slug de la entidad' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl
  const key = getApiKey()
  const encodedSlug = encodeURIComponent(slug)

  try {
    const entities = await fetchJson<Record<string, unknown>[]>(
      `${url}/rest/v1/ecclesiastical_entities?slug=eq.${encodedSlug}&select=${entityColumns}&limit=1`,
      key
    )

    const entity = entities[0]

    if (!entity) {
      return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 404 })
    }

    const entityId = String(entity.id)
    const entityTypeId = String(entity.entity_type_id)

    const [types, relationships, appointments] = await Promise.all([
      fetchJson<Record<string, unknown>[]>(
        `${url}/rest/v1/entity_types?id=eq.${entityTypeId}&select=key,name&limit=1`,
        key
      ).catch(() => []),
      fetchJson<Record<string, unknown>[]>(
        `${url}/rest/v1/entity_relationships?or=(parent_entity_id.eq.${entityId},child_entity_id.eq.${entityId})&select=${relationshipColumns}&order=start_date.desc.nullslast`,
        key
      ).catch(() => []),
      fetchJson<Record<string, unknown>[]>(
        `${url}/rest/v1/public_current_appointments?entity_id=eq.${entityId}&select=person_name,person_slug,office_name,start_date,appointment_type,notes_public&order=start_date.desc.nullslast`,
        key
      ).catch(() => [])
    ])

    const relatedIds = Array.from(
      new Set(
        relationships
          .flatMap((item) => [item.parent_entity_id, item.child_entity_id])
          .filter((id) => typeof id === 'string' && id !== entityId)
      )
    )

    let relatedEntities: Record<string, unknown>[] = []

    if (relatedIds.length > 0) {
      const ids = relatedIds.join(',')
      relatedEntities = await fetchJson<Record<string, unknown>[]>(
        `${url}/rest/v1/ecclesiastical_entities?id=in.(${ids})&select=id,name,slug`,
        key
      ).catch(() => [])
    }

    return NextResponse.json({
      entity: {
        ...entity,
        entity_type_key: types[0]?.key ?? null,
        entity_type_name: types[0]?.name ?? null,
      },
      relationships,
      related_entities: relatedEntities,
      appointments,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'No se pudo cargar la ficha de la entidad',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
