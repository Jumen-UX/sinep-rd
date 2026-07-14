import type { SupabaseClient } from '@supabase/supabase-js'

export type JsonObject = Record<string, unknown>

export type RequestRow = {
  id: string
  target_table: string | null
  action_type: string | null
  title: string
  description: string | null
  status: string
  priority: string | null
  scope_type: string | null
  scope_entity_name: string | null
  diocese_name: string | null
  pastoral_area_name: string | null
  submitted_by_name: string | null
  submitted_by_email: string | null
  submitted_at: string | null
  created_at: string
}

export type PublicSuggestion = {
  id: string
  target_table: string
  target_slug: string | null
  target_title: string | null
  page_url: string | null
  suggestion_type: string
  title: string
  description: string
  proposed_data: Record<string, unknown> | null
  source_name: string | null
  source_url: string | null
  submitter_name: string | null
  submitter_email: string | null
  submitter_country: string | null
  status: string
  priority: string
  created_at: string
}

export type ChangeRequestDetail = {
  id: string
  target_table: string | null
  target_id: string | null
  action_type: string | null
  title: string | null
  description: string | null
  original_data: JsonObject | null
  proposed_data: JsonObject | null
  status: string | null
  submitted_by_name: string | null
  submitted_by_email: string | null
  submitted_at: string | null
  created_at: string | null
  can_review: boolean
}

export type RequestQueueData = {
  requests: RequestRow[]
  publicSuggestions: PublicSuggestion[]
}

function throwIfError(error: { message: string } | null | undefined, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

export async function hasRequestAdminSession(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser()
  return !error && Boolean(data.user)
}

export async function loadRequestQueue(supabase: SupabaseClient): Promise<RequestQueueData> {
  const [requestResult, publicResult] = await Promise.all([
    supabase
      .from('admin_pending_change_requests')
      .select('id,target_table,action_type,title,description,status,priority,scope_type,scope_entity_name,diocese_name,pastoral_area_name,submitted_by_name,submitted_by_email,submitted_at,created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('admin_public_change_suggestions')
      .select('id,target_table,target_slug,target_title,page_url,suggestion_type,title,description,proposed_data,source_name,source_url,submitter_name,submitter_email,submitter_country,status,priority,created_at')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: false }),
  ])

  throwIfError(requestResult.error, 'No se pudieron cargar las solicitudes administrativas.')
  throwIfError(publicResult.error, 'No se pudieron cargar las sugerencias públicas.')

  return {
    requests: (requestResult.data ?? []) as RequestRow[],
    publicSuggestions: (publicResult.data ?? []) as PublicSuggestion[],
  }
}

export async function loadChangeRequestDetail(
  supabase: SupabaseClient,
  requestId: string,
): Promise<ChangeRequestDetail | null> {
  const { data, error } = await supabase.rpc('admin_get_change_request_detail', {
    p_change_request_id: requestId,
  })

  throwIfError(error, 'No se pudo cargar la solicitud.')
  const firstRow = Array.isArray(data) ? data[0] : null
  return (firstRow ?? null) as ChangeRequestDetail | null
}

export async function reviewPersonChangeRequest(
  supabase: SupabaseClient,
  input: {
    requestId: string
    decision: 'approved' | 'rejected'
    rejectionReason?: string | null
  },
) {
  const { error } = await supabase.rpc('admin_review_person_change_request', {
    p_change_request_id: input.requestId,
    p_decision: input.decision,
    p_rejection_reason: input.decision === 'rejected' ? input.rejectionReason ?? null : null,
  })

  throwIfError(error, 'No se pudo revisar la solicitud.')
}
