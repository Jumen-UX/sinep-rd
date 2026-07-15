import type { SupabaseClient } from '@supabase/supabase-js'
import type { VerificationStatus } from '@/features/shared/source-verification'

export type PendingEvent = {
  source_kind: string
  event_id: string
  event_date: string | null
  title: string
  event_type_name: string | null
  related_entity_name: string | null
  source_name: string | null
  evidence_status: string | null
  load_mode: string
  workflow_status: string
}

export type ReviewEvent = {
  id: string
  title: string
  description: string | null
  event_date: string | null
  effective_date: string | null
  status: string
  load_mode: string
  evidence_status: string
  verification_status: VerificationStatus
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  notes: Record<string, unknown> | null
  event_type_key: string
  event_type_name: string
  applies_to: string
  created_at: string
  approved_at: string | null
  applied_at: string | null
}

export type ReviewParticipant = {
  id: string
  role: string
  target_kind: 'entity' | 'organization_unit'
  entity_id: string | null
  entity_name: string | null
  entity_type_key: string | null
  entity_type_name: string | null
  organization_unit_id: string | null
  organization_unit_name: string | null
  organization_chart_id: string | null
  organization_chart_name: string | null
  scope_entity_id: string | null
  scope_entity_name: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
}

export type ReviewChecks = {
  has_title: boolean
  has_event_type: boolean
  has_date_or_initial_snapshot: boolean
  has_effective_date: boolean
  has_participant: boolean
  has_source_reference: boolean
  has_verification_contract: boolean
  has_action_plan: boolean
  has_blocking_action: boolean
  is_pending_review: boolean
  can_approve: boolean
}

export type EventReviewData = {
  event: ReviewEvent
  participants: ReviewParticipant[]
  review_checks: ReviewChecks
}

export type EventReviewAction = 'approve' | 'cancel' | 'return_to_draft'

export type EventWorkflowHealthCounts = {
  canonical_events_total: number
  pending_review_events: number
  approved_events: number
  event_action_types: number
  event_actions_total: number
  ready_actions: number
  failed_actions: number
  canonical_relationships_active: number
}

export type EventWorkflowHealthReadiness = {
  backend_schema_ready: boolean
  event_lifecycle_rpcs_ready: boolean
  action_plan_ready: boolean
  relationship_review_ready: boolean
  application_contract_ready: boolean
  workflow_does_not_apply_state: boolean
  requires_functional_ui_test: boolean
  has_testable_event: boolean
}

export type EventWorkflowHealth = {
  workflow: string
  status: string
  counts: EventWorkflowHealthCounts
  readiness: EventWorkflowHealthReadiness
  required_manual_test: string[]
  next_gate: string
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function loadPendingEvents(supabase: SupabaseClient): Promise<PendingEvent[]> {
  const { data, error } = await supabase.rpc('get_event_registry_stream', {
    p_year: null,
    p_month: null,
    p_event_type: null,
    p_entity_id: null,
    p_limit: 300,
  })

  throwIfError(error, 'No se pudo cargar la cola de eventos.')

  return ((data ?? []) as PendingEvent[]).filter(
    (event) => event.source_kind === 'canonical_event'
      && ['draft', 'pending_review', 'approved'].includes(event.workflow_status),
  )
}

export async function loadEventReview(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventReviewData | null> {
  const { data, error } = await supabase.rpc('get_event_review', { p_event_id: eventId })
  throwIfError(error, 'No se pudo cargar la revisión del evento.')
  return (data ?? null) as EventReviewData | null
}

export async function submitEventReview(
  supabase: SupabaseClient,
  eventId: string,
  action: EventReviewAction,
  reviewNote: string,
) {
  const { error } = await supabase.rpc('admin_review_event', {
    payload: {
      event_id: eventId,
      action,
      review_note: reviewNote || null,
    },
  })

  throwIfError(error, 'No se pudo completar la revisión del evento.')
}

export async function loadEventWorkflowHealth(
  supabase: SupabaseClient,
): Promise<EventWorkflowHealth | null> {
  const { data, error } = await supabase.rpc('get_event_workflow_health')
  throwIfError(error, 'No se pudo cargar la verificación del flujo.')
  return (data ?? null) as EventWorkflowHealth | null
}
