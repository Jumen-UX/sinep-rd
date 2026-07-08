import { NextResponse } from 'next/server'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

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
    const [dioceses, parishes, people, pastoralEntities, organizationCharts, organizationUnits] = await Promise.all([
      fetchSupabaseJson<DioceseRow[]>('public_dioceses', {
        select: 'id,slug,name,entity_type_name,ecclesiastical_province_name,current_ordinary_name,current_ordinary_title,population_total,catholics_total,parishes_count',
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
      countries: [{ key: 'DO', name: 'República Dominicana' }],
      dioceses,
      parishes,
      people,
      pastoral_entities: pastoralEntities,
      organization_charts: organizationCharts,
      organization_units: organizationUnits,
    })
  } catch (error) {
    console.error('Unexpected public dashboard views API error', error)
    return NextResponse.json({ error: 'No se pudieron cargar las vistas públicas' }, { status: 500 })
  }
}
