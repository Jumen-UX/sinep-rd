import { NextRequest, NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

const entityColumns = [
  'id','entity_type_id','name','official_name','slug','description','latin_name','cathedral_name',
  'current_ordinary_name','current_ordinary_title','territory_summary','area_km2','statistics_year',
  'population_total','catholics_total','catholics_percent','parishes_count','source_name','source_url',
  'source_checked_at','country','province','municipality','sector','address','email','phone','website',
  'facebook_url','instagram_url','youtube_url','status','visibility','erected_at','created_at','updated_at'
].join(',')

const relationshipColumns = [
  'id','parent_entity_id','child_entity_id','relationship_type','start_date','end_date','is_current','status','notes','created_at'
].join(',')

const appointmentColumns = [
  'id','person_id','office_id','entity_id','start_date','end_date','is_current','appointment_type','notes_public','status','visibility'
].join(',')

const evolutionColumns = [
  'id','event_type','event_date','title','description','from_entity_display_name','from_entity_slug','from_entity_name',
  'to_entity_display_name','to_entity_slug','to_entity_name','related_entity_display_name','related_entity_slug','related_entity_name',
  'territory_summary','canonical_effect','source_name','source_checked_at','verification_status'
].join(',')

const statisticsColumns = [
  'id','statistics_year','catholics_total','population_total','catholics_percent','diocesan_priests_count',
  'religious_priests_count','total_priests_count','catholics_per_priest','permanent_deacons_count',
  'male_religious_count','female_religious_count','parishes_count','source_code','source_name','verification_status'
].join(',')

const positionColumns = [
  'id','person_id','person_name','person_slug','position_title','office_configuration_key','base_role_name','scope_name','category_name',
  'organization_chart_name','organization_chart_key','organization_unit_name','direct_entity_name','direct_entity_slug','direct_entity_type_name',
  'parish_name','parish_slug','zone_name','zone_slug','vicariate_name','vicariate_slug','diocese_name','diocese_slug','hierarchy_path',
  'pastoral_entity_name','pastoral_entity_slug','predecessor_person_name','predecessor_person_slug','successor_person_name',
  'successor_person_slug','start_date','term_start_date','term_end_date','actual_end_date','is_current','assignment_status',
  'selection_method','notes_public'
].join(',')

function byId(items: Record<string, unknown>[]) {
  return new Map(items.map((item) => [String(item.id), item]))
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'Falta el slug de la entidad' }, { status: 400 })
  }

  try {
    const entities = await fetchSupabaseJson<Record<string, unknown>[]>('ecclesiastical_entities', {
      slug: `eq.${slug}`,
      select: entityColumns,
      limit: '1',
    })

    const entity = entities[0]

    if (!entity) {
      return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 404 })
    }

    const entityId = String(entity.id)
    const entityTypeId = String(entity.entity_type_id)
    const positionFilter = `or=(direct_entity_slug.eq.${slug},parish_slug.eq.${slug},zone_slug.eq.${slug},vicariate_slug.eq.${slug},diocese_slug.eq.${slug})`

    const [types, relationships, currentAppointments, appointmentRows, evolutionEvents, statisticsSnapshots, positions] = await Promise.all([
      fetchSupabaseJson<Record<string, unknown>[]>('entity_types', {
        id: `eq.${entityTypeId}`,
        select: 'key,name',
        limit: '1',
      }).catch(() => []),
      fetchSupabaseJson<Record<string, unknown>[]>('entity_relationships', {
        or: `(parent_entity_id.eq.${entityId},child_entity_id.eq.${entityId})`,
        select: relationshipColumns,
        order: 'start_date.desc.nullslast',
      }).catch(() => []),
      fetchSupabaseJson<Record<string, unknown>[]>('public_current_appointments', {
        entity_id: `eq.${entityId}`,
        select: 'person_name,person_slug,office_name,start_date,appointment_type,notes_public',
        order: 'start_date.desc.nullslast',
      }).catch(() => []),
      fetchSupabaseJson<Record<string, unknown>[]>('appointments', {
        entity_id: `eq.${entityId}`,
        status: 'eq.active',
        visibility: 'eq.public',
        select: appointmentColumns,
        order: 'start_date.asc.nullslast',
      }).catch(() => []),
      fetchSupabaseJson<Record<string, unknown>[]>('public_entity_evolution_events', {
        entity_id: `eq.${entityId}`,
        select: evolutionColumns,
        order: 'event_date.asc.nullslast',
      }).catch(() => []),
      fetchSupabaseJson<Record<string, unknown>[]>('public_entity_statistics_snapshots', {
        entity_id: `eq.${entityId}`,
        select: statisticsColumns,
        order: 'statistics_year.asc',
      }).catch(() => []),
      fetchSupabaseJson<Record<string, unknown>[]>('public_position_assignments_with_hierarchy', {
        or: positionFilter.replace(/^or=/, ''),
        select: positionColumns,
        order: 'start_date.desc.nullslast',
      }).catch(() => [])
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
      relatedEntities = await fetchSupabaseJson<Record<string, unknown>[]>('ecclesiastical_entities', {
        id: `in.(${relatedIds.join(',')})`,
        select: 'id,name,slug',
      }).catch(() => [])
    }

    const personIds = Array.from(new Set(appointmentRows.map((item) => item.person_id).filter(Boolean).map(String)))
    const officeIds = Array.from(new Set(appointmentRows.map((item) => item.office_id).filter(Boolean).map(String)))

    const [people, offices, clergyProfiles] = await Promise.all([
      personIds.length > 0
        ? fetchSupabaseJson<Record<string, unknown>[]>('persons', {
            id: `in.(${personIds.join(',')})`,
            select: 'id,display_name,slug,person_type,birth_date,death_date,age_text',
          }).catch(() => [])
        : Promise.resolve([]),
      officeIds.length > 0
        ? fetchSupabaseJson<Record<string, unknown>[]>('offices', {
            id: `in.(${officeIds.join(',')})`,
            select: 'id,name,key',
          }).catch(() => [])
        : Promise.resolve([]),
      personIds.length > 0
        ? fetchSupabaseJson<Record<string, unknown>[]>('clergy_profiles', {
            person_id: `in.(${personIds.join(',')})`,
            select: 'person_id,diaconal_ordination_date,priestly_ordination_date,episcopal_ordination_date,canonical_status',
          }).catch(() => [])
        : Promise.resolve([])
    ])

    const peopleById = byId(people)
    const officesById = byId(offices)
    const clergyByPersonId = new Map(clergyProfiles.map((item) => [String(item.person_id), item]))

    const appointmentHistory = appointmentRows.map((appointment) => {
      const person = peopleById.get(String(appointment.person_id))
      const office = officesById.get(String(appointment.office_id))
      const clergy = clergyByPersonId.get(String(appointment.person_id))

      return {
        ...appointment,
        person_name: person?.display_name ?? null,
        person_slug: person?.slug ?? null,
        person_type: person?.person_type ?? null,
        birth_date: person?.birth_date ?? null,
        death_date: person?.death_date ?? null,
        age_text: person?.age_text ?? null,
        office_name: office?.name ?? null,
        office_key: office?.key ?? null,
        diaconal_ordination_date: clergy?.diaconal_ordination_date ?? null,
        priestly_ordination_date: clergy?.priestly_ordination_date ?? null,
        episcopal_ordination_date: clergy?.episcopal_ordination_date ?? null,
        canonical_status: clergy?.canonical_status ?? null,
      }
    })

    return NextResponse.json({
      entity: {
        ...entity,
        entity_type_key: types[0]?.key ?? null,
        entity_type_name: types[0]?.name ?? null,
      },
      relationships,
      related_entities: relatedEntities,
      appointments: currentAppointments,
      appointment_history: appointmentHistory,
      evolution_events: evolutionEvents,
      statistics_snapshots: statisticsSnapshots,
      positions,
    })
  } catch (error) {
    console.error('Unexpected entity API error', error)
    return NextResponse.json(
      {
        error: 'No se pudo cargar la ficha de la entidad',
      },
      { status: 500 }
    )
  }
}
