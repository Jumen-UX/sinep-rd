import type { SupabaseClient } from '@supabase/supabase-js'

export type OrganizationChart = {
  id: string
  key: string
  name: string
  description: string | null
  visibility: string
}

export type OrganizationUnit = {
  id: string
  organization_chart_id: string
  parent_unit_id: string | null
  key: string
  name: string
  description: string | null
  visibility: string
  status: string
}

type NamedRecord = {
  display_name?: string | null
  name?: string | null
}

export type NamedRelation = NamedRecord | NamedRecord[] | null

export type OrganizationAssignment = {
  id: string
  organization_chart_id: string | null
  organization_unit_id: string | null
  assignment_status: string
  visibility: string
  publication_status: string
  persons: NamedRelation
  office_configurations: NamedRelation
}

export type OrganizationChartSnapshot = {
  charts: OrganizationChart[]
  units: OrganizationUnit[]
  assignments: OrganizationAssignment[]
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function hasOrganizationChartAdminSession(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser()
  throwIfError(error, 'No se pudo comprobar la sesión administrativa.')
  return Boolean(data.user)
}

export async function loadOrganizationChartSnapshot(supabase: SupabaseClient): Promise<OrganizationChartSnapshot> {
  const [chartResult, unitResult, assignmentResult] = await Promise.all([
    supabase.from('organization_charts').select('id,key,name,description,visibility').eq('status', 'active').order('sort_order'),
    supabase.from('organization_units').select('id,organization_chart_id,parent_unit_id,key,name,description,visibility,status').eq('status', 'active').order('sort_order'),
    supabase
      .from('position_assignments')
      .select('id,organization_chart_id,organization_unit_id,assignment_status,visibility,publication_status,persons(display_name),office_configurations(display_name)')
      .eq('record_status', 'active')
      .eq('is_current', true)
      .order('created_at', { ascending: false }),
  ])

  throwIfError(chartResult.error, 'No se pudieron cargar los organigramas.')
  throwIfError(unitResult.error, 'No se pudieron cargar las unidades organizativas.')
  throwIfError(assignmentResult.error, 'No se pudieron cargar las asignaciones actuales.')

  return {
    charts: (chartResult.data ?? []) as OrganizationChart[],
    units: (unitResult.data ?? []) as OrganizationUnit[],
    assignments: (assignmentResult.data ?? []) as unknown as OrganizationAssignment[],
  }
}
