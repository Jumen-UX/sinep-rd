import type { SupabaseClient } from '@supabase/supabase-js'

export type ActionStatus = 'planned' | 'ready' | 'applied' | 'skipped' | 'failed'

export type PlanEvent = {
  id: string
  title: string
  status: string
  load_mode: string
  evidence_status: string
  verification_status: string
  event_date: string | null
  effective_date: string | null
  event_type_key: string
  event_type_name: string
  applies_to: string
}

export type PlanAction = {
  id: string
  action_type_key: string
  action_type_name: string
  description: string | null
  changes_state: boolean
  requires_manual_review: boolean
  status: ActionStatus
  notes: string | null
  subject_entity_id: string | null
  subject_entity_name: string | null
  target_entity_id: string | null
  target_entity_name: string | null
  subject_organization_unit_id: string | null
  subject_organization_unit_name: string | null
  target_organization_unit_id: string | null
  target_organization_unit_name: string | null
  relationship_type_id: string | null
  relationship_type_name: string | null
  payload: Record<string, unknown>
  sort_order: number
}

export type PlanSummary = {
  action_count: number
  ready_count: number
  planned_count: number
  applied_count: number
  skipped_count: number
  failed_count: number
  state_changing_count: number
  manual_review_count: number
  can_generate_plan: boolean
  can_apply_now: boolean
  apply_lock_reason: string | null
}

export type ApplicationPlan = {
  event: PlanEvent
  actions: PlanAction[]
  summary: PlanSummary
}

export type EntityOption = {
  id: string
  name: string
  official_name: string | null
  entity_type_key: string
  entity_type_name: string
}

export type RelationshipTypeOption = {
  id: string
  key: string
  name: string
  description: string | null
  source_entity_type: string | null
  target_entity_type: string | null
  is_hierarchical: boolean
  is_historical: boolean
}

export type EditorOptions = {
  entities: EntityOption[]
  relationship_types: RelationshipTypeOption[]
}

export type RelationshipConflict = {
  severity: 'error' | 'warning'
  code: string
  message: string
}

export type RelationshipConflictAction = {
  action_id: string
  conflicts: RelationshipConflict[]
  is_clear: boolean
}

export type ConflictPreview = {
  action_count: number
  conflict_count: number
  error_count: number
  warning_count: number
  actions: RelationshipConflictAction[]
}

export const emptyConflictPreview: ConflictPreview = {
  action_count: 0,
  conflict_count: 0,
  error_count: 0,
  warning_count: 0,
  actions: [],
}

export type EventApplicationPlanData = {
  plan: ApplicationPlan | null
  editorOptions: EditorOptions | null
  conflictPreview: ConflictPreview
}

export type ContractEvent = {
  id: string
  title: string
  status: string
  load_mode: string
  evidence_status: string
  event_type_key: string
  event_type_name: string
  applies_to: string
}

export type ContractSummary = {
  event_exists: boolean
  event_status: string
  applies_to: string
  action_count: number
  ready_count: number
  planned_count: number
  applied_count: number
  failed_count: number
  state_changing_count: number
  manual_only_count: number
  relationship_error_count: number
  relationship_warning_count: number
  can_apply: boolean
  apply_lock_reason: string | null
}

export type ContractAction = {
  id: string
  action_type_key: string
  action_type_name: string
  status: string
  changes_state: boolean
  requires_manual_review: boolean
  auto_apply_allowed: boolean
  apply_strategy: string
  implementation_phase: string
  contract_status: string
  subject_entity_name: string | null
  target_entity_name: string | null
  subject_organization_unit_name: string | null
  target_organization_unit_name: string | null
  relationship_type_name: string | null
  sort_order: number
}

export type ApplicationContract = {
  event: ContractEvent
  summary: ContractSummary
  actions: ContractAction[]
}

export type ApplyEventResult = {
  applied_action_count?: number
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function loadEventRelationshipConflictPreview(
  supabase: SupabaseClient,
  eventId: string,
  appliesTo?: string | null,
): Promise<ConflictPreview> {
  if (appliesTo === 'organization_unit') return emptyConflictPreview

  const { data, error } = await supabase.rpc('get_event_relationship_conflict_preview', {
    p_event_id: eventId,
  })
  throwIfError(error, 'No se pudo revisar los conflictos relacionales.')
  return (data ?? emptyConflictPreview) as ConflictPreview
}

export async function loadEventApplicationPlan(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventApplicationPlanData> {
  const [planResult, optionsResult] = await Promise.all([
    supabase.rpc('get_event_application_plan', { p_event_id: eventId }),
    supabase.rpc('get_event_action_editor_options'),
  ])

  throwIfError(planResult.error, 'No se pudo cargar el plan de aplicación.')
  throwIfError(optionsResult.error, 'No se pudieron cargar las opciones del editor.')

  const plan = (planResult.data ?? null) as ApplicationPlan | null
  const conflictPreview = await loadEventRelationshipConflictPreview(
    supabase,
    eventId,
    plan?.event.applies_to,
  )

  return {
    plan,
    editorOptions: (optionsResult.data ?? null) as EditorOptions | null,
    conflictPreview,
  }
}

export async function generateEventActionPlan(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ApplicationPlan | null> {
  const { data, error } = await supabase.rpc('admin_generate_event_action_plan', {
    payload: { event_id: eventId },
  })
  throwIfError(error, 'No se pudo generar el plan de acciones.')
  return (data ?? null) as ApplicationPlan | null
}

export async function updateEventAction(
  supabase: SupabaseClient,
  actionId: string,
  status: Exclude<ActionStatus, 'applied'>,
): Promise<ApplicationPlan | null> {
  const { data, error } = await supabase.rpc('admin_update_event_action', {
    payload: { action_id: actionId, status },
  })
  throwIfError(error, 'No se pudo actualizar la acción del evento.')
  return (data ?? null) as ApplicationPlan | null
}

export async function configureEventAction(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<ApplicationPlan | null> {
  const { data, error } = await supabase.rpc('admin_configure_event_action', { payload })
  throwIfError(error, 'No se pudo configurar la acción del evento.')
  return (data ?? null) as ApplicationPlan | null
}

export async function loadEventApplicationContract(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ApplicationContract | null> {
  const { data, error } = await supabase.rpc('get_event_application_contract', {
    p_event_id: eventId,
  })
  throwIfError(error, 'No se pudo cargar el contrato de aplicación.')
  return (data ?? null) as ApplicationContract | null
}

export async function applyOrganizationUnitEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ApplyEventResult> {
  const { data, error } = await supabase.rpc('admin_apply_organization_unit_event', {
    payload: { event_id: eventId },
  })
  throwIfError(error, 'No se pudo aplicar el evento organizativo.')
  return (data ?? {}) as ApplyEventResult
}
