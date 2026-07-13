import { fetchSupabaseJson } from '@/lib/supabase/rest'

export type PublicView = 'territorial' | 'clero' | 'pastoral' | 'administrativa' | 'colegial'

export type Diocese = {
  id: string
  slug: string
  name: string
  entity_type_name: string | null
  ecclesiastical_province_name: string | null
  current_ordinary_name: string | null
  current_ordinary_title: string | null
  population_total: number | null
  catholics_total: number | null
  parishes_count: number | null
  country_iso2: string | null
  country_name: string | null
}

export type Parish = {
  id: string
  name?: string | null
  slug?: string | null
  diocese_id: string | null
  diocese_name: string | null
  diocese_slug: string | null
}

export type Person = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
  is_religious?: boolean | null
  status: string | null
  death_date: string | null
}

export type Assignment = {
  id: string
  person_id: string
  person_name: string | null
  person_slug: string | null
  person_type: string | null
  position_title: string | null
  base_role_name: string | null
  direct_entity_name: string | null
  direct_entity_slug: string | null
  direct_entity_type_name: string | null
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
  is_current: boolean | null
  assignment_status: string | null
}

export type OrganizationChart = {
  id: string
  key: string
  name: string
  description: string | null
}

export type OrganizationUnit = {
  id: string
  organization_chart_id: string
  organization_chart_key: string
  organization_chart_name: string
  organization_chart_sort_order: number | null
  parent_unit_id: string | null
  parent_unit_name: string | null
  parent_unit_slug: string | null
  ecclesiastical_entity_id: string | null
  ecclesiastical_entity_name: string | null
  ecclesiastical_entity_slug: string | null
  pastoral_area_id: string | null
  pastoral_area_name: string | null
  pastoral_area_slug: string | null
  key: string
  slug: string
  name: string
  description: string | null
  sort_order: number | null
  valid_from: string | null
  valid_to: string | null
  is_current: boolean
}

export type PublicDashboardData = {
  countries: { key: string; name: string }[]
  dioceses: Diocese[]
  parishes: Parish[]
  people: Person[]
  assignments: Assignment[]
  organization_charts: OrganizationChart[]
  organization_units: OrganizationUnit[]
}

export type DashboardSummary = {
  dioceses: {
    total: number
    archdioceses: number
    dioceses: number
    military: number
    provinces: { name: string; count: number }[]
    total_catholics: number
    total_population: number
    total_parishes: number
    loaded_parishes: number
    reported_parishes: number
  }
  people: {
    total: number
    bishops: number
    priests: number
    deacons: number
    religious: number
    laypeople: number
    active: number
  }
}

function normalizeText(value?: string | null) {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function isArchdiocese(item: Pick<Diocese, 'entity_type_name'>) {
  return normalizeText(item.entity_type_name).includes('arquidiocesis')
}

function isDiocese(item: Pick<Diocese, 'entity_type_name'>) {
  const name = normalizeText(item.entity_type_name)
  return name.includes('diocesis') && !name.includes('arquidiocesis')
}

function isMilitary(item: Pick<Diocese, 'entity_type_name' | 'name'>) {
  const name = normalizeText(`${item.entity_type_name ?? ''} ${item.name}`)
  return name.includes('castrense') || name.includes('militar')
}

async function safeFetch<T>(table: string, params: Record<string, string>) {
  try {
    return await fetchSupabaseJson<T[]>(table, params)
  } catch (error) {
    console.warn(`Public dashboard optional source unavailable: ${table}`, error)
    return []
  }
}

export async function loadPublicDashboardData(): Promise<PublicDashboardData> {
  const [countries, dioceses, parishes, people, assignments, organizationCharts, organizationUnits] = await Promise.all([
    safeFetch<{ key: string; name: string }>('public_countries', { select: 'key,name', order: 'name.asc' }),
    fetchSupabaseJson<Diocese[]>('public_dioceses', { select: 'id,slug,name,entity_type_name,ecclesiastical_province_name,current_ordinary_name,current_ordinary_title,population_total,catholics_total,parishes_count,country_iso2,country_name', order: 'name.asc' }),
    safeFetch<Parish>('public_parishes', { select: 'id,name,slug,diocese_id,diocese_name,diocese_slug', status: 'eq.active', visibility: 'eq.public', order: 'name.asc' }),
    fetchSupabaseJson<Person[]>('person_public_directory', { select: 'id,display_name,slug,person_type,is_religious,status,death_date', status: 'eq.active', visibility: 'eq.public', death_date: 'is.null', order: 'display_name.asc' }),
    safeFetch<Assignment>('public_position_assignments_with_hierarchy', { select: 'id,person_id,person_name,person_slug,person_type,position_title,base_role_name,direct_entity_name,direct_entity_slug,direct_entity_type_name,parish_name,parish_slug,zone_name,zone_slug,vicariate_name,vicariate_slug,diocese_name,diocese_slug,organization_unit_name,organization_unit_slug,is_current,assignment_status', is_current: 'eq.true', order: 'person_name.asc' }),
    safeFetch<OrganizationChart>('organization_charts', { select: 'id,key,name,description', status: 'eq.active', visibility: 'eq.public', order: 'sort_order.asc,name.asc' }),
    safeFetch<OrganizationUnit>('public_organization_units', { select: 'id,organization_chart_id,organization_chart_key,organization_chart_name,organization_chart_sort_order,parent_unit_id,parent_unit_name,parent_unit_slug,ecclesiastical_entity_id,ecclesiastical_entity_name,ecclesiastical_entity_slug,pastoral_area_id,pastoral_area_name,pastoral_area_slug,key,slug,name,description,sort_order,valid_from,valid_to,is_current', status: 'eq.active', visibility: 'eq.public', is_current: 'eq.true', order: 'organization_chart_sort_order.asc,sort_order.asc,name.asc' }),
  ])

  return {
    countries: countries.length > 0 ? countries : [{ key: 'DO', name: 'República Dominicana' }],
    dioceses,
    parishes,
    people,
    assignments,
    organization_charts: organizationCharts,
    organization_units: organizationUnits,
  }
}

export async function loadDashboardSummary(): Promise<DashboardSummary> {
  const [dioceses, parishes, people] = await Promise.all([
    fetchSupabaseJson<Diocese[]>('public_dioceses', { select: 'id,slug,name,entity_type_name,ecclesiastical_province_name,current_ordinary_name,current_ordinary_title,population_total,catholics_total,parishes_count,country_iso2,country_name', order: 'name.asc' }),
    fetchSupabaseJson<{ id: string }[]>('public_ecclesiastical_entities', { select: 'id', entity_type_key: 'eq.parish', status: 'eq.active', visibility: 'eq.public' }),
    fetchSupabaseJson<Person[]>('person_public_directory', { select: 'id,display_name,slug,person_type,is_religious,status,death_date' }),
  ])

  const provinceMap = dioceses.reduce((map, item) => {
    if (item.ecclesiastical_province_name) map.set(item.ecclesiastical_province_name, (map.get(item.ecclesiastical_province_name) ?? 0) + 1)
    return map
  }, new Map<string, number>())
  const provinces = Array.from(provinceMap, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const countPeople = (type: string) => people.filter((item) => item.person_type === type).length

  return {
    dioceses: {
      total: dioceses.length,
      archdioceses: dioceses.filter(isArchdiocese).length,
      dioceses: dioceses.filter(isDiocese).length,
      military: dioceses.filter(isMilitary).length,
      provinces,
      total_catholics: dioceses.reduce((sum, item) => sum + (item.catholics_total ?? 0), 0),
      total_population: dioceses.reduce((sum, item) => sum + (item.population_total ?? 0), 0),
      total_parishes: parishes.length,
      loaded_parishes: parishes.length,
      reported_parishes: parishes.length,
    },
    people: {
      total: people.length,
      bishops: countPeople('bishop'),
      priests: countPeople('priest'),
      deacons: countPeople('deacon'),
      religious: people.filter((item) => item.is_religious).length,
      laypeople: countPeople('layperson'),
      active: people.filter((item) => item.status === 'active' && !item.death_date).length,
    },
  }
}
