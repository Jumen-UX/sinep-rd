import { cache } from 'react'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

export type PublicEntity = {
  id: string
  name: string
  official_name: string | null
  slug: string
  description: string | null
  entity_type_key: string | null
  entity_type_name: string | null
  latin_name: string | null
  cathedral_name: string | null
  territory_summary: string | null
  area_km2: number | null
  statistics_year: number | null
  population_total: number | null
  catholics_total: number | null
  catholics_percent: number | null
  parishes_count: number | null
  source_name: string | null
  source_checked_at: string | null
  country: string | null
  province: string | null
  municipality: string | null
  address: string | null
  phone: string | null
  website: string | null
  erected_at: string | null
}

export type PublicEntityRelationship = {
  id: string
  parent_entity_id: string
  child_entity_id: string
  relationship_type: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  status: string | null
  notes: string | null
}

export type PublicRelatedEntity = {
  id: string
  name: string
  slug: string
}

export type PublicEntityAppointment = {
  person_name: string | null
  person_slug: string | null
  office_name: string | null
  start_date: string | null
  notes_public: string | null
}

export type PublicEntityAppointmentHistory = {
  id: string
  person_name: string | null
  person_slug: string | null
  person_type: string | null
  office_name: string | null
  office_key: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  notes_public: string | null
  birth_date: string | null
  age_text: string | null
  death_date: string | null
  priestly_ordination_date: string | null
  episcopal_ordination_date: string | null
}

export type PublicEntityEvolutionEvent = {
  id: string
  event_type: string | null
  event_date: string | null
  title: string | null
  description: string | null
  from_entity_display_name: string | null
  from_entity_slug: string | null
  from_entity_name: string | null
  to_entity_display_name: string | null
  to_entity_slug: string | null
  to_entity_name: string | null
  related_entity_display_name: string | null
  related_entity_slug: string | null
  related_entity_name: string | null
  territory_summary: string | null
  canonical_effect: string | null
  source_name: string | null
  source_checked_at: string | null
  verification_status: string | null
}

export type PublicEntityStatisticsSnapshot = {
  id: string
  statistics_year: number
  catholics_total: number | null
  population_total: number | null
  catholics_percent: number | null
  total_priests_count: number | null
  permanent_deacons_count: number | null
  male_religious_count: number | null
  female_religious_count: number | null
  parishes_count: number | null
  source_code: string | null
}

export type PublicEntityPosition = {
  id: string
  person_name: string | null
  person_slug: string | null
  position_title: string | null
  organization_chart_name: string | null
  organization_chart_key: string | null
  organization_unit_name: string | null
  direct_entity_name: string | null
  direct_entity_slug: string | null
  direct_entity_type_name: string | null
  hierarchy_path: string | null
  parish_name: string | null
  parish_slug: string | null
  zone_name: string | null
  zone_slug: string | null
  vicariate_name: string | null
  vicariate_slug: string | null
  diocese_name: string | null
  diocese_slug: string | null
  organization_unit_name: string | null
  organization_unit_slug: string | null
  predecessor_person_name: string | null
  predecessor_person_slug: string | null
  successor_person_name: string | null
  successor_person_slug: string | null
  start_date: string | null
  term_start_date: string | null
  term_end_date: string | null
  actual_end_date: string | null
  is_current: boolean
  assignment_status: string | null
}

export type PublicEntityDetail = {
  entity: PublicEntity
  relationships: PublicEntityRelationship[]
  related_entities: PublicRelatedEntity[]
  appointments: PublicEntityAppointment[]
  appointment_history: PublicEntityAppointmentHistory[]
  evolution_events: PublicEntityEvolutionEvent[]
  statistics_snapshots: PublicEntityStatisticsSnapshot[]
  positions: PublicEntityPosition[]
}

const entityColumns = [
  'id','entity_type_id','name','official_name','slug','description','latin_name','cathedral_name','territory_summary',
  'area_km2','statistics_year','population_total','catholics_total','catholics_percent','parishes_count','source_name',
  'source_checked_at','country','province','municipality','address','phone','website','erected_at',
].join(',')

const relationshipColumns = [
  'id','parent_entity_id','child_entity_id','relationship_type','start_date','end_date','is_current','status','notes',
].join(',')

const appointmentColumns = [
  'id','person_id','office_id','entity_id','start_date','end_date','is_current','appointment_type','notes_public',
].join(',')

const evolutionColumns = [
  'id','event_type','event_date','title','description','from_entity_display_name','from_entity_slug','from_entity_name',
  'to_entity_display_name','to_entity_slug','to_entity_name','related_entity_display_name','related_entity_slug',
  'related_entity_name','territory_summary','canonical_effect','source_name','source_checked_at','verification_status',
].join(',')

const statisticsColumns = [
  'id','statistics_year','catholics_total','population_total','catholics_percent','total_priests_count',
  'permanent_deacons_count','male_religious_count','female_religious_count','parishes_count','source_code',
].join(',')

const positionColumns = [
  'id','person_name','person_slug','position_title','organization_chart_name','organization_chart_key','organization_unit_name',
  'direct_entity_name','direct_entity_slug','direct_entity_type_name','hierarchy_path','parish_name','parish_slug','zone_name',
  'zone_slug','vicariate_name','vicariate_slug','diocese_name','diocese_slug','organization_unit_name','organization_unit_slug',
  'predecessor_person_name','predecessor_person_slug','successor_person_name','successor_person_slug','start_date',
  'term_start_date','term_end_date','actual_end_date','is_current','assignment_status',
].join(',')

function byId(items: Record<string, unknown>[]) {
  return new Map(items.map((item) => [String(item.id), item] as const))
}

async function fetchPublicEntityDetail(slug: string): Promise<PublicEntityDetail | null> {
  const entities = await fetchSupabaseJson<Array<Record<string, unknown>>>('ecclesiastical_entities', {
    slug: `eq.${slug}`,
    status: 'eq.active',
    visibility: 'eq.public',
    select: entityColumns,
    limit: '1',
  })

  const rawEntity = entities[0]
  if (!rawEntity) return null

  const entityId = String(rawEntity.id)
  const entityTypeId = String(rawEntity.entity_type_id)
  const positionFilter = `(direct_entity_slug.eq.${slug},parish_slug.eq.${slug},zone_slug.eq.${slug},vicariate_slug.eq.${slug},diocese_slug.eq.${slug})`

  const [types, relationships, currentAppointments, appointmentRows, evolutionEvents, statisticsSnapshots, positions] = await Promise.all([
    fetchSupabaseJson<Array<{ key: string; name: string }>>('entity_types', {
      id: `eq.${entityTypeId}`,
      select: 'key,name',
      limit: '1',
    }).catch(() => []),
    fetchSupabaseJson<PublicEntityRelationship[]>('entity_relationships', {
      or: `(parent_entity_id.eq.${entityId},child_entity_id.eq.${entityId})`,
      select: relationshipColumns,
      order: 'start_date.desc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<PublicEntityAppointment[]>('public_current_appointments', {
      entity_id: `eq.${entityId}`,
      select: 'person_name,person_slug,office_name,start_date,notes_public',
      order: 'start_date.desc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<Array<Record<string, unknown>>>('appointments', {
      entity_id: `eq.${entityId}`,
      status: 'eq.active',
      visibility: 'eq.public',
      select: appointmentColumns,
      order: 'start_date.asc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<PublicEntityEvolutionEvent[]>('public_entity_evolution_events', {
      entity_id: `eq.${entityId}`,
      select: evolutionColumns,
      order: 'event_date.asc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<PublicEntityStatisticsSnapshot[]>('public_entity_statistics_snapshots', {
      entity_id: `eq.${entityId}`,
      select: statisticsColumns,
      order: 'statistics_year.asc',
    }).catch(() => []),
    fetchSupabaseJson<PublicEntityPosition[]>('public_position_assignments_with_hierarchy', {
      or: positionFilter,
      select: positionColumns,
      order: 'start_date.desc.nullslast',
    }).catch(() => []),
  ])

  const relatedIds = Array.from(new Set(
    relationships
      .flatMap((item) => [item.parent_entity_id, item.child_entity_id])
      .filter((id) => id && id !== entityId),
  ))

  const relatedEntities = relatedIds.length > 0
    ? await fetchSupabaseJson<PublicRelatedEntity[]>('ecclesiastical_entities', {
        id: `in.(${relatedIds.join(',')})`,
        status: 'eq.active',
        visibility: 'eq.public',
        select: 'id,name,slug',
      }).catch(() => [])
    : []

  const personIds = Array.from(new Set(appointmentRows.map((item) => item.person_id).filter(Boolean).map(String)))
  const officeIds = Array.from(new Set(appointmentRows.map((item) => item.office_id).filter(Boolean).map(String)))

  const [people, offices, clergyProfiles] = await Promise.all([
    personIds.length > 0
      ? fetchSupabaseJson<Array<Record<string, unknown>>>('persons', {
          id: `in.(${personIds.join(',')})`,
          status: 'eq.active',
          visibility: 'eq.public',
          select: 'id,display_name,slug,person_type,birth_date,death_date,age_text',
        }).catch(() => [])
      : Promise.resolve([]),
    officeIds.length > 0
      ? fetchSupabaseJson<Array<Record<string, unknown>>>('offices', {
          id: `in.(${officeIds.join(',')})`,
          select: 'id,name,key',
        }).catch(() => [])
      : Promise.resolve([]),
    personIds.length > 0
      ? fetchSupabaseJson<Array<Record<string, unknown>>>('clergy_profiles', {
          person_id: `in.(${personIds.join(',')})`,
          select: 'person_id,priestly_ordination_date,episcopal_ordination_date',
        }).catch(() => [])
      : Promise.resolve([]),
  ])

  const peopleById = byId(people)
  const officesById = byId(offices)
  const clergyByPersonId = new Map<string, Record<string, unknown>>(
    clergyProfiles.map((item) => [String(item.person_id), item] as const),
  )

  const appointmentHistory: PublicEntityAppointmentHistory[] = appointmentRows.map((appointment) => {
    const person = peopleById.get(String(appointment.person_id))
    const office = officesById.get(String(appointment.office_id))
    const clergy = clergyByPersonId.get(String(appointment.person_id))

    return {
      id: String(appointment.id),
      person_name: typeof person?.display_name === 'string' ? person.display_name : null,
      person_slug: typeof person?.slug === 'string' ? person.slug : null,
      person_type: typeof person?.person_type === 'string' ? person.person_type : null,
      office_name: typeof office?.name === 'string' ? office.name : null,
      office_key: typeof office?.key === 'string' ? office.key : null,
      start_date: typeof appointment.start_date === 'string' ? appointment.start_date : null,
      end_date: typeof appointment.end_date === 'string' ? appointment.end_date : null,
      is_current: appointment.is_current === true,
      notes_public: typeof appointment.notes_public === 'string' ? appointment.notes_public : null,
      birth_date: typeof person?.birth_date === 'string' ? person.birth_date : null,
      age_text: typeof person?.age_text === 'string' ? person.age_text : null,
      death_date: typeof person?.death_date === 'string' ? person.death_date : null,
      priestly_ordination_date: typeof clergy?.priestly_ordination_date === 'string' ? clergy.priestly_ordination_date : null,
      episcopal_ordination_date: typeof clergy?.episcopal_ordination_date === 'string' ? clergy.episcopal_ordination_date : null,
    }
  })

  const entity: PublicEntity = {
    id: entityId,
    name: String(rawEntity.name),
    official_name: typeof rawEntity.official_name === 'string' ? rawEntity.official_name : null,
    slug: String(rawEntity.slug),
    description: typeof rawEntity.description === 'string' ? rawEntity.description : null,
    entity_type_key: types[0]?.key ?? null,
    entity_type_name: types[0]?.name ?? null,
    latin_name: typeof rawEntity.latin_name === 'string' ? rawEntity.latin_name : null,
    cathedral_name: typeof rawEntity.cathedral_name === 'string' ? rawEntity.cathedral_name : null,
    territory_summary: typeof rawEntity.territory_summary === 'string' ? rawEntity.territory_summary : null,
    area_km2: typeof rawEntity.area_km2 === 'number' ? rawEntity.area_km2 : null,
    statistics_year: typeof rawEntity.statistics_year === 'number' ? rawEntity.statistics_year : null,
    population_total: typeof rawEntity.population_total === 'number' ? rawEntity.population_total : null,
    catholics_total: typeof rawEntity.catholics_total === 'number' ? rawEntity.catholics_total : null,
    catholics_percent: typeof rawEntity.catholics_percent === 'number' ? rawEntity.catholics_percent : null,
    parishes_count: typeof rawEntity.parishes_count === 'number' ? rawEntity.parishes_count : null,
    source_name: typeof rawEntity.source_name === 'string' ? rawEntity.source_name : null,
    source_checked_at: typeof rawEntity.source_checked_at === 'string' ? rawEntity.source_checked_at : null,
    country: typeof rawEntity.country === 'string' ? rawEntity.country : null,
    province: typeof rawEntity.province === 'string' ? rawEntity.province : null,
    municipality: typeof rawEntity.municipality === 'string' ? rawEntity.municipality : null,
    address: typeof rawEntity.address === 'string' ? rawEntity.address : null,
    phone: typeof rawEntity.phone === 'string' ? rawEntity.phone : null,
    website: typeof rawEntity.website === 'string' ? rawEntity.website : null,
    erected_at: typeof rawEntity.erected_at === 'string' ? rawEntity.erected_at : null,
  }

  return {
    entity,
    relationships,
    related_entities: relatedEntities,
    appointments: currentAppointments,
    appointment_history: appointmentHistory,
    evolution_events: evolutionEvents,
    statistics_snapshots: statisticsSnapshots,
    positions,
  }
}

export const loadPublicEntityDetail = cache(fetchPublicEntityDetail)
