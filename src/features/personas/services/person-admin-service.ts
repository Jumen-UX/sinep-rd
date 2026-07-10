import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminPersonDetail = {
  person_id: string
  display_name: string | null
  person_type: string | null
  status: string | null
  birth_date: string | null
  birth_place: string | null
  death_date: string | null
  photo_url?: string | null
  biography_public: string | null
  current_entity_name?: string | null
  current_pastoral_entity_name?: string | null
  incardination_entity_name?: string | null
  priest_type: string | null
  deacon_type: string | null
  canonical_status: string | null
  religious_institute_name: string | null
  can_update_proposal: boolean
  can_approve?: boolean
}

export type PersonChangeProposalInput = {
  display_name: string
  person_type: string
  status: string
  birth_date: string
  birth_place: string
  death_date: string
  biography_public: string
  priest_type: string
  deacon_type: string
  canonical_status: string
  religious_institute_name: string
}

export async function getAdminPersonDetail(supabase: SupabaseClient, personId: string) {
  const { data, error } = await supabase.rpc('admin_get_person_detail', {
    p_person_id: personId,
  })

  if (error) throw error
  const firstRow = Array.isArray(data) ? data[0] : null
  return (firstRow ?? null) as AdminPersonDetail | null
}

export async function createPersonChangeProposal(
  supabase: SupabaseClient,
  personId: string,
  proposedData: PersonChangeProposalInput,
  description: string,
) {
  const { data, error } = await supabase.rpc('admin_create_person_change_proposal', {
    p_person_id: personId,
    p_proposed_data: proposedData,
    p_description: description,
  })

  if (error) throw error
  return typeof data === 'object' && data && 'id' in data ? String(data.id) : null
}
