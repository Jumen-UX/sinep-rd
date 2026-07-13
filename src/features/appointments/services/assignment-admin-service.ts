import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAllowedOfficeIds } from '@/features/personas/shared/services/person-placement-service'

export type AssignmentPerson = {
  id: string
  display_name: string
  slug: string
  highest_ordination_degree: 'diaconate' | 'presbyterate' | 'episcopate' | null
  effective_person_type: string | null
}

export type AssignmentOfficeConfiguration = {
  id: string
  key: string
  display_name: string
  organization_chart_id: string | null
  default_term_months: number | null
  continues_until_replaced: boolean
  required_ordination_degree: 'none' | 'diaconate' | 'presbyterate' | 'episcopate'
  allowed_person_types: string[]
  allowed_episcopal_role_types: string[]
  allowed_clerical_statuses: string[]
  holder_cardinality: 'single' | 'multiple'
  max_current_holders: number | null
}

export type AssignmentChart = {
  id: string
  key: string
  name: string
}

export type AssignmentUnit = {
  id: string
  name: string
  slug: string
  organization_chart_id: string
}

export type AssignmentRow = {
  id: string
  person_name: string | null
  person_slug: string | null
  position_title: string | null
  organization_chart_name: string | null
  organization_unit_name: string | null
  direct_entity_name: string | null
  hierarchy_path: string | null
  predecessor_person_name: string | null
  successor_person_name: string | null
  start_date: string | null
  term_start_date: string | null
  term_end_date: string | null
  actual_end_date: string | null
  assignment_status: string | null
}

export type RawAssignment = {
  id: string
  person_id: string | null
  office_configuration_id: string
  organization_chart_id: string | null
  organization_unit_id: string | null
  ecclesiastical_entity_id: string | null
  title_override: string | null
  is_current: boolean
  record_status: string
}

export type AssignmentEligibility = {
  eligible: boolean
  reason_code: string
  message: string
  person_category?: string
  highest_ordination_degree?: string | null
  current_clerical_status?: string
  required_ordination_degree?: string
  allowed_episcopal_role_types?: string[]
  office_name?: string
}

export type AssignmentCatalogs = {
  people: AssignmentPerson[]
  configs: AssignmentOfficeConfiguration[]
  charts: AssignmentChart[]
  units: AssignmentUnit[]
  assignments: AssignmentRow[]
  rawAssignments: RawAssignment[]
}

export type SaveAssignmentResponse = {
  assignment_id?: string
  closed_previous_current_count?: number
  holder_cardinality?: 'single' | 'multiple'
  max_current_holders?: number | null
  eligibility?: AssignmentEligibility
  error?: string
}

export { loadAllowedOfficeIds }

export async function loadAssignmentCatalogs(supabase: SupabaseClient): Promise<AssignmentCatalogs> {
  const [peopleResult, configResult, chartResult, unitResult, assignmentResult, rawAssignmentResult] = await Promise.all([
    supabase
      .from('person_ecclesial_state')
      .select('id,display_name,slug,highest_ordination_degree,effective_person_type')
      .eq('status', 'active')
      .order('display_name'),
    supabase
      .from('office_configurations')
      .select('id,key,display_name,organization_chart_id,default_term_months,continues_until_replaced,required_ordination_degree,allowed_person_types,allowed_episcopal_role_types,allowed_clerical_statuses,holder_cardinality,max_current_holders')
      .eq('status', 'active')
      .order('display_name'),
    supabase.from('organization_charts').select('id,key,name').eq('status', 'active').order('sort_order'),
    supabase.from('organization_units').select('id,name,slug,organization_chart_id').eq('status', 'active').eq('is_current', true).order('name'),
    supabase
      .from('public_position_assignments_with_hierarchy')
      .select('id,person_name,person_slug,position_title,organization_chart_name,organization_unit_name,direct_entity_name,hierarchy_path,predecessor_person_name,successor_person_name,start_date,term_start_date,term_end_date,actual_end_date,assignment_status')
      .order('start_date', { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from('position_assignments')
      .select('id,person_id,office_configuration_id,organization_chart_id,organization_unit_id,ecclesiastical_entity_id,title_override,is_current,record_status')
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const error = peopleResult.error
    ?? configResult.error
    ?? chartResult.error
    ?? unitResult.error
    ?? assignmentResult.error
    ?? rawAssignmentResult.error
  if (error) throw error

  return {
    people: (peopleResult.data ?? []) as AssignmentPerson[],
    configs: (configResult.data ?? []) as AssignmentOfficeConfiguration[],
    charts: (chartResult.data ?? []) as AssignmentChart[],
    units: (unitResult.data ?? []) as AssignmentUnit[],
    assignments: (assignmentResult.data ?? []) as AssignmentRow[],
    rawAssignments: (rawAssignmentResult.data ?? []) as RawAssignment[],
  }
}

export async function checkAssignmentEligibility(
  supabase: SupabaseClient,
  personId: string,
  officeConfigurationId: string,
  ecclesiasticalEntityId: string | null,
): Promise<AssignmentEligibility> {
  const { data, error } = await supabase.rpc('admin_check_position_assignment_eligibility', {
    p_person_id: personId,
    p_office_configuration_id: officeConfigurationId,
    p_ecclesiastical_entity_id: ecclesiasticalEntityId,
  })

  if (error) throw error
  return data as AssignmentEligibility
}

export async function saveAssignment(payload: Record<string, unknown>): Promise<SaveAssignmentResponse> {
  const response = await fetch('/api/admin/asignacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json() as SaveAssignmentResponse
  if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar la asignación.')
  return data
}
