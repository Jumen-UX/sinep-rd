import type { SupabaseClient } from '@supabase/supabase-js'

export type OrganizationEventType = {
  key: string
  name: string
  description: string | null
}

export type OrganizationEventAction = {
  id: string
  action_type_key: string
  action_type_name: string
  description: string | null
  status: 'planned' | 'ready' | 'applied' | 'skipped' | 'failed'
  notes: string | null
  changes_state: boolean
  requires_manual_review: boolean
  subject_organization_unit_id: string | null
  subject_organization_unit_name: string | null
  target_organization_unit_id: string | null
  target_organization_unit_name: string | null
  payload: Record<string, unknown>
  sort_order: number
}

export type OrganizationEventPlan = {
  event: {
    id: string
    title: string
    status: 'draft' | 'pending_review' | 'approved' | 'applied' | 'cancelled' | 'corrected'
    event_type_key: string
    event_type_name: string
    applies_to: string
    event_date: string | null
    effective_date: string | null
  }
  actions: OrganizationEventAction[]
  summary: {
    action_count: number
    ready_count: number
    planned_count: number
    applied_count: number
    failed_count: number
    can_generate_plan: boolean
    can_apply_now: boolean
    apply_lock_reason: string | null
  }
}

export async function loadOrganizationEventTypes(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('canonical_event_types')
    .select('key,name,description')
    .eq('applies_to', 'organization_unit')
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return (data ?? []) as OrganizationEventType[]
}

export async function createOrganizationEventDraft(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc('admin_create_event_draft', { payload })
  if (error) throw error
  if (typeof data !== 'string') throw new Error('La RPC no devolvió el identificador del evento.')
  return data
}

export async function loadOrganizationEventPlan(
  supabase: SupabaseClient,
  eventId: string,
): Promise<OrganizationEventPlan> {
  const { data, error } = await supabase.rpc('get_event_application_plan', { p_event_id: eventId })
  if (error) throw error
  return data as OrganizationEventPlan
}

export async function generateOrganizationEventPlan(
  supabase: SupabaseClient,
  eventId: string,
): Promise<OrganizationEventPlan> {
  const { data, error } = await supabase.rpc('admin_generate_event_action_plan', {
    payload: { event_id: eventId },
  })
  if (error) throw error
  return data as OrganizationEventPlan
}

export async function reviewOrganizationEvent(
  supabase: SupabaseClient,
  eventId: string,
  action: 'approve' | 'return_to_draft' | 'cancel',
  reviewNote: string,
) {
  const { data, error } = await supabase.rpc('admin_review_event', {
    payload: { event_id: eventId, action, review_note: reviewNote || null },
  })
  if (error) throw error
  return data as { event_id: string; status: string; applies_to: string }
}

export async function applyOrganizationEvent(
  supabase: SupabaseClient,
  eventId: string,
) {
  const { data, error } = await supabase.rpc('admin_apply_organization_unit_event', {
    payload: { event_id: eventId },
  })
  if (error) throw error
  return data as {
    event_id: string
    status: string
    organization_unit_id: string | null
    applied_action_count: number
  }
}
