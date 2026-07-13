import { fetchSupabaseJson } from '@/lib/supabase/rest'

export type DioceseDirectoryItem = {
  id: string
  slug: string
  name: string
  entity_type_name: string | null
  ecclesiastical_province_name: string | null
  province: string | null
  municipality: string | null
  latin_name: string | null
  cathedral_name: string | null
  current_ordinary_name: string | null
  current_ordinary_title: string | null
  territory_summary: string | null
  area_km2: number | null
  statistics_year: number | null
  population_total: number | null
  catholics_total: number | null
  catholics_percent: number | null
  parishes_count: number | null
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  erected_at: string | null
}

export type PersonDirectoryItem = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
  highest_ordination_degree: 'diaconate' | 'presbyterate' | 'episcopate' | null
  is_cleric: boolean
  is_lay: boolean
  is_religious: boolean
  religious_life_type: string | null
  photo_url: string | null
  biography_public: string | null
  status: string | null
  death_date: string | null
  age_text: string | null
}

export type PersonFilter = 'all' | 'bishop' | 'priest' | 'deacon' | 'religious' | 'layperson' | 'active'
export type DioceseFilter = 'all' | 'archdiocese' | 'diocese' | 'military' | string

const dioceseColumns = ['id','slug','name','entity_type_name','ecclesiastical_province_name','province','municipality','latin_name','cathedral_name','current_ordinary_name','current_ordinary_title','territory_summary','area_km2','statistics_year','population_total','catholics_total','catholics_percent','parishes_count','source_name','source_url','source_checked_at','erected_at'].join(',')
const personColumns = ['id','display_name','slug','person_type','highest_ordination_degree','is_cleric','is_lay','is_religious','religious_life_type','photo_url','biography_public','status','death_date','age_text'].join(',')

export function normalizePersonFilter(value: string | null | undefined): PersonFilter {
  if (value === 'lay') return 'layperson'
  const allowed: PersonFilter[] = ['all', 'bishop', 'priest', 'deacon', 'religious', 'layperson', 'active']
  return allowed.includes(value as PersonFilter) ? value as PersonFilter : 'all'
}

export function normalizeDioceseFilter(value: string | null | undefined): DioceseFilter {
  return value || 'all'
}

export async function loadPeopleDirectory(filter: PersonFilter, limit?: number) {
  const params: Record<string, string> = { status: 'eq.active', visibility: 'eq.public', select: personColumns, order: 'display_name.asc' }
  if (filter === 'religious') params.is_religious = 'eq.true'
  else if (filter !== 'all' && filter !== 'active') params.person_type = `eq.${filter}`
  if (filter === 'active') params.death_date = 'is.null'
  if (limit && Number.isInteger(limit) && limit > 0) params.limit = String(limit)
  return fetchSupabaseJson<PersonDirectoryItem[]>('person_public_directory', params)
}

export async function loadDioceseDirectory(filter: DioceseFilter, province?: string | null, limit?: number) {
  const params: Record<string, string | string[]> = { select: dioceseColumns, order: 'name.asc' }
  if (province) params.ecclesiastical_province_name = `eq.${province}`
  if (filter === 'archdiocese') params.or = '(entity_type_name.ilike.*arquidiócesis*,entity_type_name.ilike.*arquidiocesis*)'
  else if (filter === 'diocese') params.entity_type_name = ['ilike.*diócesis*', 'not.ilike.*arquidiócesis*']
  else if (filter === 'military') params.or = '(entity_type_name.ilike.*castrense*,entity_type_name.ilike.*militar*,name.ilike.*castrense*,name.ilike.*militar*)'
  if (limit && Number.isInteger(limit) && limit > 0) params.limit = String(limit)
  return fetchSupabaseJson<DioceseDirectoryItem[]>('public_dioceses', params)
}

export type PublicPersonMetadata = { display_name: string; slug: string; person_type: string | null; biography_public: string | null; photo_url: string | null }
export type PublicEntityMetadata = { name: string; slug: string; description: string | null; official_name: string | null; cathedral_name: string | null }

export async function loadPublicPersonMetadata(slug: string) {
  const rows = await fetchSupabaseJson<PublicPersonMetadata[]>('persons', { slug: `eq.${slug}`, status: 'eq.active', visibility: 'eq.public', select: 'display_name,slug,person_type,biography_public,photo_url', limit: '1' }).catch(() => [])
  return rows[0] ?? null
}

export async function loadPublicEntityMetadata(slug: string) {
  const rows = await fetchSupabaseJson<PublicEntityMetadata[]>('ecclesiastical_entities', { slug: `eq.${slug}`, status: 'eq.active', visibility: 'eq.public', select: 'name,slug,description,official_name,cathedral_name', limit: '1' }).catch(() => [])
  return rows[0] ?? null
}
