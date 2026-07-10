import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminOrdinationRecord = {
  degree: 'diaconate' | 'presbyterate' | 'episcopate'
  ordination_date: string | null
  ordination_place: string | null
  verification_status: string | null
}

export type AdminClericalHistoryRecord = {
  dimension_type: 'incardination' | 'canonical_status' | 'episcopal_role' | 'dignity'
  dimension_key: string
  display_title: string | null
  related_entity_name: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  has_right_of_succession: boolean | null
}

export type AdminEpiscopalRoleRecord = {
  role_type: string
  jurisdiction_name: string | null
  title_see_name: string | null
  start_date: string | null
  has_right_of_succession: boolean
}

export type AdminDignityRecord = {
  dignity_type: string
  title_text: string | null
  start_date: string | null
}

export type AdminPersonDetail = {
  person_id: string
  display_name: string | null
  person_type: string | null
  effective_person_type?: string | null
  highest_ordination_degree?: 'diaconate' | 'presbyterate' | 'episcopate' | null
  ecclesial_condition?: 'lay' | 'cleric' | null
  status: string | null
  birth_date: string | null
  birth_place: string | null
  death_date: string | null
  photo_url?: string | null
  biography_public: string | null
  current_entity_name?: string | null
  current_pastoral_entity_name?: string | null
  incardination_entity_name?: string | null
  incardination_institute_name?: string | null
  incardination_kind?: string | null
  priest_type: string | null
  deacon_type: string | null
  canonical_status: string | null
  religious_institute_name: string | null
  ordination_history: AdminOrdinationRecord[]
  clerical_history: AdminClericalHistoryRecord[]
  episcopal_roles: AdminEpiscopalRoleRecord[]
  ecclesiastical_dignities: AdminDignityRecord[]
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
  if (!firstRow) return null

  const [stateResult, ordinationResult, historyResult, roleResult, dignityResult] = await Promise.all([
    supabase
      .from('person_current_clerical_state')
      .select('effective_person_type,highest_ordination_degree,ecclesial_condition,canonical_status,incardination_entity_name,incardination_institute_name,incardination_kind')
      .eq('id', personId)
      .maybeSingle(),
    supabase
      .from('person_public_ordination_history')
      .select('degree,ordination_date,ordination_place,verification_status')
      .eq('person_id', personId)
      .order('ordination_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('person_public_clerical_history')
      .select('dimension_type,dimension_key,display_title,related_entity_name,start_date,end_date,is_current,has_right_of_succession')
      .eq('person_id', personId)
      .order('start_date', { ascending: false, nullsFirst: false }),
    supabase
      .from('person_current_episcopal_roles')
      .select('role_type,jurisdiction_name,title_see_name,start_date,has_right_of_succession')
      .eq('person_id', personId)
      .order('start_date', { ascending: false, nullsFirst: false }),
    supabase
      .from('person_current_ecclesiastical_dignities')
      .select('dignity_type,title_text,start_date')
      .eq('person_id', personId)
      .order('start_date', { ascending: false, nullsFirst: false }),
  ])

  for (const result of [stateResult, ordinationResult, historyResult, roleResult, dignityResult]) {
    if (result.error) throw result.error
  }

  const state = stateResult.data

  return {
    ...firstRow,
    effective_person_type: state?.effective_person_type ?? firstRow.person_type ?? null,
    highest_ordination_degree: state?.highest_ordination_degree ?? null,
    ecclesial_condition: state?.ecclesial_condition ?? null,
    canonical_status: state?.canonical_status ?? firstRow.canonical_status ?? null,
    incardination_entity_name: state?.incardination_entity_name ?? firstRow.incardination_entity_name ?? null,
    incardination_institute_name: state?.incardination_institute_name ?? null,
    incardination_kind: state?.incardination_kind ?? null,
    ordination_history: (ordinationResult.data ?? []) as AdminOrdinationRecord[],
    clerical_history: (historyResult.data ?? []) as AdminClericalHistoryRecord[],
    episcopal_roles: (roleResult.data ?? []) as AdminEpiscopalRoleRecord[],
    ecclesiastical_dignities: (dignityResult.data ?? []) as AdminDignityRecord[],
  } as AdminPersonDetail
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
