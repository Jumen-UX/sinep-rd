import type { SupabaseClient } from '@supabase/supabase-js'

export type AccountRole = {
  assignment_id: string
  role_key: string
  role_name: string
  scope_type: string
  scope_entity_id: string | null
}

export type AccountAccessRequest = {
  id: string
  request_type: 'initial_access' | 'person_link' | 'scope_change' | 'role_change' | 'account_closure'
  status: 'draft' | 'submitted' | 'under_review' | 'information_required' | 'approved' | 'rejected' | 'cancelled'
  requested_person_id: string | null
  requested_country_entity_id: string | null
  requested_role_id: string | null
  requested_scope_type: string | null
  requested_scope_id: string | null
  justification: string | null
  requester_notes: string | null
  reviewer_notes: string | null
  submitted_at: string | null
  reviewed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export type AccountProfile = {
  user_id: string
  email: string
  full_name: string
  phone: string | null
  status: string
  person_id: string | null
  registration_source: 'invitation' | 'self_registration' | 'administrative_provisioning'
  preferred_locale: string
  timezone: string
  avatar_url: string | null
  terms_accepted_at: string | null
  terms_version: string | null
  privacy_accepted_at: string | null
  privacy_version: string | null
  onboarding_step: 'profile' | 'access' | 'complete'
  onboarding_completed_at: string | null
}

export type AccountContext = {
  profile: AccountProfile
  roles: AccountRole[]
  access_requests: AccountAccessRequest[]
}

export async function loadMyAccountContext(supabase: SupabaseClient): Promise<AccountContext> {
  const { data, error } = await supabase.rpc('get_my_account_context')
  if (error) throw new Error(error.message || 'No se pudo cargar tu cuenta.')
  return data as AccountContext
}
