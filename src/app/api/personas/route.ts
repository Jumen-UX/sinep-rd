import { NextRequest, NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

const listColumns = [
  'id',
  'display_name',
  'slug',
  'person_type',
  'photo_url',
  'photo_path',
  'biography_public',
  'birth_date',
  'age_text',
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
  'age_text',
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

const positionColumns = [
  'id',
  'person_id',
  'person_name',
  'person_slug',
  'position_title',
  'office_configuration_key',
  'base_role_name',
  'scope_name',
  'category_name',
  'organization_chart_name',
  'organization_chart_key',
  'organization_unit_name',
  'ecclesiastical_entity_name',
  'ecclesiastical_entity_slug',
  'pastoral_entity_name',
  'pastoral_entity_slug',
  'predecessor_person_name',
  'predecessor_person_slug',
  'successor_person_name',
  'successor_person_slug',
  'start_date',
  'term_start_date',
  'term_end_date',
  'actual_end_date',
  'is_current',
  'assignment_status',
  'selection_method',
  'notes_public'
].join(',')

const canonicalHelpColumns = [
  'office_configuration_key',
  'canonical_name',
  'short_definition',
  'full_definition',
  'canon_reference',
  'requires_priest',
  'requires_bishop',
  'canonical_context',
  'source_title',
  'source_url'
].join(',')

function normalizePersonType(value: string | null) {
  if (!value || value === 'all' || value === 'active') return value
  if (value === 'lay') return 'layperson'
  return value
}

async function attachCanonicalHelp(positions: Record<string, unknown>[]) {
  const configurationKeys = Array.from(new Set(positions.map((item) => item.office_configuration_key).filter(Boolean).map(String)))
  if (configurationKeys.length === 0) return positions

  const helpRows = await fetchSupabaseJson<Record<string, unknown>[]>('public_office_canonical_help', {
    office_configuration_key: `in.(${configurationKeys.join(',')})`,
    select: canonicalHelpColumns,
  }).catch(() => [])

  const helpByKey = new Map(helpRows.map((item) => [String(item.office_configuration_key), item]))

  return positions.map((position) => {
    const help = helpByKey.get(String(position.office_configuration_key ?? ''))
    if (!help?.canonical_name) return position

    return {
      ...position,
      canonical_name: help.canonical_name,
      canonical_short_definition: help.short_definition,
      canonical_full_definition: help.full_definition,
      canonical_reference: help.canon_reference,
      canonical_requires_priest: help.requires_priest,
      canonical_requires_bishop: help.requires_bishop,
      canonical_context: help.canonical_context,
      canonical_source_title: help.source_title,
      canonical_source_url: help.source_url,
    }
  })
}

function buildListFilters(request: NextRequest) {
  const tipo = normalizePersonType(request.nextUrl.searchParams.get('tipo'))
  const limit = request.nextUrl.searchParams.get('limit')
  const filters: Record<string, string> = {
    status: 'eq.active',
    visibility: 'eq.public',
    select: listColumns,
    order: 'display_name.asc',
  }

  if (tipo && tipo !== 'all' && tipo !== 'active') {
    filters.person_type = `eq.${tipo}`
  }

  if (tipo === 'active') {
    filters.death_date = 'is.null'
  }

  if (limit && /^\d+$/.test(limit)) {
    filters.limit = limit
  }

  return filters
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')

  try {
    if (!slug) {
      const people = await fetchSupabaseJson<Record<string, unknown>[]>('persons', buildListFilters(request))
      return NextResponse.json(people)
    }

    const people = await fetchSupabaseJson<Record<string, unknown>[]>('persons', {
      slug: `eq.${slug}`,
      status: 'eq.active',
      visibility: 'eq.public',
      select: personColumns,
      limit: '1',
    })

    const person = people[0]

    if (!person) {
      return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })
    }

    const [clergyRows, appointments, movements, episcopalOrdinations, positionRows] = await Promise.all([
      fetchSupabaseJson<Record<string, unknown>[]>('public_clergy', {
        slug: `eq.${slug}`,
        select: clergyColumns,
        limit: '1',
      }).catch(() => []),
      fetchSupabaseJson<Record<string, unknown>[]>('public_current_appointments', {
        person_slug: `eq.${slug}`,
        select: appointmentColumns,
        order: 'start_date.desc.nullslast',
      }).catch(() => []),
      fetchSupabaseJson<Record<string, unknown>[]>('public_person_movements', {
        person_slug: `eq.${slug}`,
        select: movementColumns,
        order: 'effective_date.desc.nullslast',
      }).catch(() => []),
      fetchSupabaseJson<Record<string, unknown>[]>('public_episcopal_ordinations', {
        bishop_slug: `eq.${slug}`,
        select: episcopalOrdinationColumns,
        limit: '1',
      }).catch(() => []),
      fetchSupabaseJson<Record<string, unknown>[]>('public_position_assignments', {
        person_slug: `eq.${slug}`,
        select: positionColumns,
        order: 'start_date.desc.nullslast',
      }).catch(() => [])
    ])

    const positions = await attachCanonicalHelp(positionRows)

    return NextResponse.json({
      person,
      clergy: clergyRows[0] ?? null,
      appointments,
      movements,
      episcopal_ordination: episcopalOrdinations[0] ?? null,
      positions,
    })
  } catch (error) {
    console.error('Unexpected people API error', error)
    return NextResponse.json(
      {
        error: 'No se pudo cargar la información de personas',
      },
      { status: 500 }
    )
  }
}
