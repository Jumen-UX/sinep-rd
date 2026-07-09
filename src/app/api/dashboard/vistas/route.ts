import { NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

type CountryRow = {
  key: string
  iso2: string
  iso3: string | null
  name: string
  official_name: string | null
  flag_emoji: string | null
  flag_image_url: string | null
  flag_alt: string | null
}

type DioceseRow = {
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

type ParishRow = {
  id: string
  diocese_id: string | null
  diocese_name: string | null
  diocese_slug: string | null
}

type PersonRow = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
  status: string | null
  death_date: string | null
}

type AssignmentRow = {
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
  pastoral_entity_name: string | null
  pastoral_entity_slug: string | null
  is_current: boolean | null
  assignment_status: string | null
}

type PastoralEntityRow = {
  id: string
  name: string
  slug: string
  diocese_id: string | null
  diocese_name: string | null
  diocese_slug: string | null
  level_name: string | null
  level_key: string | null
  level_order: number | null
  parent_pastoral_entity_id: string | null
  parent_pastoral_entity_name: string | null
}

type OrganizationChartRow = {
  id: string
  key: string
  name: string
  description: string | null
}

type OrganizationUnitRow = {
  id: string
  organization_chart_id: string | null
  parent_unit_id: string | null
  name: string
  description: string | null
}

async function safeFetch<T>(table: string, params: Record<string, string>) {
  try {
    return await fetchSupabaseJson<T[]>(table, params)
  } catch (error) {
    console.warn(`Public dashboard optional source unavailable: ${table}`, error)
    return []
  }
}

export async function GET() {
  try {
    const [countries, dioceses, parishes, people, assignments, pastoralEntities, organizationCharts, organizationUnits] = await Promise.all([
      safeFetch<CountryRow>('public_countries', {
        select: 'key,iso2,iso3,name,official_name,flag_emoji,flag_image_url,flag_alt',
        order: 'name.asc',
      }),
      fetchSupabaseJson<DioceseRow[]>('public_dioceses', {
        select: 'id,slug,name,entity_type_name,ecclesiastical_province_name,current_ordinary_name,current_ordinary_title,population_total,catholics_total,parishes_count,country_iso2,country_name',
        order: 'name.asc',
      }),
      safeFetch<ParishRow>('public_parishes', {
        select: 'id,diocese_id,diocese_name,diocese_slug',
        status: 'eq.active',
        visibility: 'eq.public',
        order: 'name.asc',
      }),
      fetchSupabaseJson<PersonRow[]>('persons', {
        select: 'id,display_name,slug,person_type,status,death_date',
        status: 'eq.active',
        visibility: 'eq.public',
        order: 'display_name.asc',
      }),
      safeFetch<AssignmentRow>('public_position_assignments_with_hierarchy', {
        select: 'id,person_id,person_name,person_slug,person_type,position_title,base_role_name,direct_entity_name,direct_entity_slug,direct_entity_type_name,parish_name,parish_slug,zone_name,zone_slug,vicariate_name,vicariate_slug,diocese_name,diocese_slug,pastoral_entity_name,pastoral_entity_slug,is_current,assignment_status',
        is_current: 'eq.true',
        order: 'person_name.asc',
      }),
      safeFetch<PastoralEntityRow>('public_pastoral_entities', {
        select: 'id,name,slug,diocese_id,diocese_name,diocese_slug,level_name,level_key,level_order,parent_pastoral_entity_id,parent_pastoral_entity_name',
        status: 'eq.active',
        visibility: 'eq.public',
        order: 'level_order.asc,name.asc',
      }),
      safeFetch<OrganizationChartRow>('organization_charts', {
        select: 'id,key,name,description',
        status: 'eq.active',
        visibility: 'eq.public',
        order: 'sort_order.asc,name.asc',
      }),
      safeFetch<OrganizationUnitRow>('organization_units', {
        select: 'id,organization_chart_id,parent_unit_id,name,description',
        status: 'eq.active',
        visibility: 'eq.public',
        order: 'sort_order.asc,name.asc',
      }),
    ])

    return NextResponse.json({
      countries,
      dioceses,
      parishes,
      people,
      assignments,
      pastoral_entities: pastoralEntities,
      organization_charts: organizationCharts,
      organization_units: organizationUnits,
    })
  } catch (error) {
    console.error('Unexpected public dashboard views API error', error)
    return NextResponse.json({ error: 'No se pudieron cargar las vistas públicas' }, { status: 500 })
  }
}
