import { cache } from 'react'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

export type PublicPerson = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
  photo_url: string | null
  biography_public: string | null
  birth_date: string | null
  age_text: string | null
  birth_place: string | null
  status: string | null
  death_date: string | null
  created_at: string
  updated_at: string
}

export type PublicEcclesialState = {
  id: string
  legacy_person_type: string | null
  highest_ordination_degree: 'diaconate' | 'presbyterate' | 'episcopate' | null
  ecclesial_condition: 'lay' | 'cleric'
  is_cleric: boolean
  is_lay: boolean
  has_diaconate: boolean
  has_presbyterate: boolean
  has_episcopate: boolean
  effective_person_type: string | null
  canonical_status: string | null
  incardination_entity_id: string | null
  incardination_entity_name: string | null
  incardination_institute_name: string | null
  incardination_kind: string | null
}

export type PublicOrdinationHistory = {
  person_id: string
  degree: 'diaconate' | 'presbyterate' | 'episcopate'
  ordination_date: string | null
  ordination_place: string | null
  principal_ordainer_person_id: string | null
  principal_ordainer_name: string | null
  principal_ordainer_slug: string | null
  assistant_ordainer_1_person_id: string | null
  assistant_ordainer_1_name: string | null
  assistant_ordainer_1_slug: string | null
  assistant_ordainer_2_person_id: string | null
  assistant_ordainer_2_name: string | null
  assistant_ordainer_2_slug: string | null
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  verification_status: string | null
  notes_public: string | null
}

export type PublicClericalHistory = {
  person_id: string
  dimension_type: 'incardination' | 'canonical_status' | 'episcopal_role' | 'dignity'
  dimension_key: string
  display_title: string | null
  related_entity_id: string | null
  related_entity_name: string | null
  related_entity_slug: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  has_right_of_succession: boolean | null
  detail_text: string | null
}

export type PublicEpiscopalRole = {
  person_id: string
  role_type: string
  jurisdiction_entity_id: string | null
  jurisdiction_name: string | null
  title_see_name: string | null
  start_date: string | null
  has_right_of_succession: boolean
}

export type PublicEcclesiasticalDignity = {
  person_id: string
  dignity_type: string
  title_text: string | null
  start_date: string | null
}

export type PublicAppointment = {
  id: string
  office_name: string | null
  entity_name: string | null
  entity_slug: string | null
  organization_unit_name: string | null
  organization_unit_slug: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  appointment_type: string | null
  notes_public: string | null
}

export type PublicPosition = {
  id: string
  position_title: string | null
  organization_chart_name: string | null
  organization_chart_key: string | null
  organization_unit_name: string | null
  organization_unit_slug: string | null
  ecclesiastical_entity_name: string | null
  ecclesiastical_entity_slug: string | null
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
  selection_method: string | null
  notes_public: string | null
}

export type PublicMovement = {
  id: string
  entity_name: string | null
  entity_slug: string | null
  organization_unit_name: string | null
  organization_unit_slug: string | null
  movement_type: string | null
  title: string | null
  description: string | null
  effective_date: string | null
  end_date: string | null
}

export type PublicEpiscopalOrdination = {
  id: string
  ordination_date: string | null
  ordination_place: string | null
  principal_consecrator_person_name: string | null
  principal_consecrator_person_slug: string | null
  principal_consecrator_name: string | null
  co_consecrator_1_person_name: string | null
  co_consecrator_1_person_slug: string | null
  co_consecrator_1_name: string | null
  co_consecrator_2_person_name: string | null
  co_consecrator_2_person_slug: string | null
  co_consecrator_2_name: string | null
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  verification_status: string | null
  notes_public: string | null
}

export type PublicPersonDetail = {
  person: PublicPerson
  ecclesial_state: PublicEcclesialState | null
  ordination_history: PublicOrdinationHistory[]
  clerical_history: PublicClericalHistory[]
  episcopal_roles: PublicEpiscopalRole[]
  ecclesiastical_dignities: PublicEcclesiasticalDignity[]
  appointments: PublicAppointment[]
  positions: PublicPosition[]
  movements: PublicMovement[]
  episcopal_ordination: PublicEpiscopalOrdination | null
}

const personColumns = [
  'id','display_name','slug','person_type','photo_url','biography_public','birth_date','age_text','birth_place',
  'death_date','status','created_at','updated_at',
].join(',')

const currentEcclesialStateColumns = [
  'id','legacy_person_type','highest_ordination_degree','ecclesial_condition','is_cleric','is_lay','has_diaconate',
  'has_presbyterate','has_episcopate','effective_person_type','canonical_status','incardination_entity_id',
  'incardination_entity_name','incardination_institute_name','incardination_kind',
].join(',')

const ordinationHistoryColumns = [
  'person_id','degree','ordination_date','ordination_place','principal_ordainer_person_id','principal_ordainer_name',
  'principal_ordainer_slug','assistant_ordainer_1_person_id','assistant_ordainer_1_name','assistant_ordainer_1_slug',
  'assistant_ordainer_2_person_id','assistant_ordainer_2_name','assistant_ordainer_2_slug','source_name','source_url',
  'source_checked_at','verification_status','notes_public',
].join(',')

const clericalHistoryColumns = [
  'person_id','dimension_type','dimension_key','display_title','related_entity_id','related_entity_name',
  'related_entity_slug','start_date','end_date','is_current','has_right_of_succession','detail_text',
].join(',')

const episcopalRoleColumns = [
  'person_id','role_type','jurisdiction_entity_id','jurisdiction_name','title_see_name','start_date','has_right_of_succession',
].join(',')

const dignityColumns = ['person_id','dignity_type','title_text','start_date'].join(',')

const appointmentColumns = [
  'id','office_name','entity_name','entity_slug','organization_unit_name','organization_unit_slug','start_date','end_date',
  'is_current','appointment_type','notes_public',
].join(',')

const movementColumns = [
  'id','entity_name','entity_slug','organization_unit_name','organization_unit_slug','movement_type','title','description',
  'effective_date','end_date',
].join(',')

const episcopalOrdinationColumns = [
  'id','ordination_date','ordination_place','principal_consecrator_person_name','principal_consecrator_person_slug',
  'principal_consecrator_name','co_consecrator_1_person_name','co_consecrator_1_person_slug','co_consecrator_1_name',
  'co_consecrator_2_person_name','co_consecrator_2_person_slug','co_consecrator_2_name','source_name','source_url',
  'source_checked_at','verification_status','notes_public',
].join(',')

const positionColumns = [
  'id','position_title','organization_chart_name','organization_chart_key','organization_unit_name','organization_unit_slug',
  'ecclesiastical_entity_name','ecclesiastical_entity_slug','predecessor_person_name','predecessor_person_slug',
  'successor_person_name','successor_person_slug','start_date','term_start_date','term_end_date','actual_end_date',
  'is_current','assignment_status','selection_method','notes_public',
].join(',')

async function fetchPublicPersonDetail(slug: string): Promise<PublicPersonDetail | null> {
  const people = await fetchSupabaseJson<PublicPerson[]>('persons', {
    slug: `eq.${slug}`,
    status: 'eq.active',
    visibility: 'eq.public',
    select: personColumns,
    limit: '1',
  })

  const person = people[0]
  if (!person) return null

  const personId = person.id
  const [
    ecclesialStateRows,
    ordinationHistory,
    clericalHistory,
    episcopalRoles,
    ecclesiasticalDignities,
    appointments,
    movements,
    episcopalOrdinations,
    positions,
  ] = await Promise.all([
    fetchSupabaseJson<PublicEcclesialState[]>('person_current_clerical_state', {
      id: `eq.${personId}`,
      select: currentEcclesialStateColumns,
      limit: '1',
    }).catch(() => []),
    fetchSupabaseJson<PublicOrdinationHistory[]>('person_public_ordination_history', {
      person_id: `eq.${personId}`,
      select: ordinationHistoryColumns,
      order: 'ordination_date.asc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<PublicClericalHistory[]>('person_public_clerical_history', {
      person_id: `eq.${personId}`,
      select: clericalHistoryColumns,
      order: 'start_date.desc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<PublicEpiscopalRole[]>('person_current_episcopal_roles', {
      person_id: `eq.${personId}`,
      select: episcopalRoleColumns,
      order: 'start_date.desc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<PublicEcclesiasticalDignity[]>('person_current_ecclesiastical_dignities', {
      person_id: `eq.${personId}`,
      select: dignityColumns,
      order: 'start_date.desc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<PublicAppointment[]>('public_current_appointments', {
      person_slug: `eq.${slug}`,
      select: appointmentColumns,
      order: 'start_date.desc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<PublicMovement[]>('public_person_movements', {
      person_slug: `eq.${slug}`,
      select: movementColumns,
      order: 'effective_date.desc.nullslast',
    }).catch(() => []),
    fetchSupabaseJson<PublicEpiscopalOrdination[]>('public_episcopal_ordinations', {
      bishop_slug: `eq.${slug}`,
      select: episcopalOrdinationColumns,
      limit: '1',
    }).catch(() => []),
    fetchSupabaseJson<PublicPosition[]>('public_position_assignments', {
      person_slug: `eq.${slug}`,
      select: positionColumns,
      order: 'start_date.desc.nullslast',
    }).catch(() => []),
  ])

  return {
    person,
    ecclesial_state: ecclesialStateRows[0] ?? null,
    ordination_history: ordinationHistory,
    clerical_history: clericalHistory,
    episcopal_roles: episcopalRoles,
    ecclesiastical_dignities: ecclesiasticalDignities,
    appointments,
    positions,
    movements,
    episcopal_ordination: episcopalOrdinations[0] ?? null,
  }
}

export const loadPublicPersonDetail = cache(fetchPublicPersonDetail)
