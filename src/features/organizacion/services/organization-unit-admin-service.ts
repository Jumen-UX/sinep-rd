import type { SupabaseClient } from '@supabase/supabase-js'

export type OrganizationEntity = {
  id: string
  name: string
  slug: string
  status: string
  entity_type_id: string
}

export type OrganizationChart = {
  id: string
  key: string
  name: string
  description: string | null
  status: string
}

export type PastoralAreaOption = {
  id: string
  key: string
  name: string
  status: string
}

export type OrganizationUnit = {
  id: string
  organization_chart_id: string
  parent_unit_id: string | null
  ecclesiastical_entity_id: string
  pastoral_area_id: string | null
  key: string
  name: string
  description: string | null
  slug: string
  sort_order: number
  visibility: 'public' | 'internal' | 'private'
  status: 'active' | 'inactive' | 'archived' | 'draft'
  valid_from: string | null
  valid_to: string | null
  is_current: boolean
}

export type OrganizationUnitCatalogs = {
  entities: OrganizationEntity[]
  charts: OrganizationChart[]
  pastoralAreas: PastoralAreaOption[]
  units: OrganizationUnit[]
}

export type SaveOrganizationUnitPayload = {
  id?: string
  organization_chart_id: string
  parent_unit_id: string | null
  ecclesiastical_entity_id: string
  pastoral_area_id: string | null
  key: string | null
  name: string
  description: string | null
  sort_order: number
  visibility: OrganizationUnit['visibility']
  status: OrganizationUnit['status']
  valid_from: string | null
  valid_to: string | null
  is_current: boolean
}

export async function loadOrganizationUnitCatalogs(
  supabase: SupabaseClient,
): Promise<OrganizationUnitCatalogs> {
  const [typeResult, chartResult, pastoralAreaResult, unitResult] = await Promise.all([
    supabase.from('entity_types').select('id,key').in('key', ['diocese', 'archdiocese']),
    supabase
      .from('organization_charts')
      .select('id,key,name,description,status')
      .eq('status', 'active')
      .order('sort_order')
      .order('name'),
    supabase
      .from('pastoral_areas')
      .select('id,key,name,status')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('organization_units')
      .select('id,organization_chart_id,parent_unit_id,ecclesiastical_entity_id,pastoral_area_id,key,name,description,slug,sort_order,visibility,status,valid_from,valid_to,is_current')
      .order('sort_order')
      .order('name'),
  ])

  const initialError = typeResult.error ?? chartResult.error ?? pastoralAreaResult.error ?? unitResult.error
  if (initialError) throw initialError

  const entityTypeIds = (typeResult.data ?? []).map((row) => row.id)
  let entities: OrganizationEntity[] = []

  if (entityTypeIds.length > 0) {
    const entityResult = await supabase
      .from('ecclesiastical_entities')
      .select('id,name,slug,status,entity_type_id')
      .in('entity_type_id', entityTypeIds)
      .eq('status', 'active')
      .order('name')

    if (entityResult.error) throw entityResult.error
    entities = (entityResult.data ?? []) as OrganizationEntity[]
  }

  return {
    entities,
    charts: (chartResult.data ?? []) as OrganizationChart[],
    pastoralAreas: (pastoralAreaResult.data ?? []) as PastoralAreaOption[],
    units: (unitResult.data ?? []) as OrganizationUnit[],
  }
}

export async function saveOrganizationUnit(
  payload: SaveOrganizationUnitPayload,
): Promise<OrganizationUnit> {
  const response = await fetch('/api/admin/organizacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json() as OrganizationUnit & { error?: string }
  if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar la unidad organizativa.')
  return data
}
