import type { SupabaseClient } from '@supabase/supabase-js'

export type OrdinationDegree = 'diaconate' | 'presbyterate' | 'episcopate'
export type ProposalMode = 'keep' | 'set' | 'close'

export type AdminOrdinationRecord = {
  degree: OrdinationDegree
  ordination_date: string | null
  ordination_place: string | null
  principal_ordainer_person_id: string | null
  principal_ordainer_name: string | null
  assistant_ordainer_1_person_id: string | null
  assistant_ordainer_1_name: string | null
  assistant_ordainer_2_person_id: string | null
  assistant_ordainer_2_name: string | null
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  verification_status: string | null
  visibility: string | null
}

export type AdminClericalHistoryRecord = {
  dimension_type: 'incardination' | 'canonical_status' | 'episcopal_role' | 'dignity'
  dimension_key: string
  display_title: string | null
  related_entity_id: string | null
  related_entity_name: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  has_right_of_succession: boolean | null
  detail_text: string | null
}

export type AdminEpiscopalRoleRecord = {
  role_type: string
  jurisdiction_entity_id: string | null
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
  highest_ordination_degree?: OrdinationDegree | null
  ecclesial_condition?: 'lay' | 'cleric' | null
  status: string | null
  birth_date: string | null
  birth_place: string | null
  death_date: string | null
  photo_url?: string | null
  biography_public: string | null
  current_entity_name?: string | null
  current_pastoral_entity_name?: string | null
  incardination_entity_id?: string | null
  incardination_entity_name?: string | null
  incardination_institute_name?: string | null
  incardination_kind?: string | null
  priest_type: string | null
  deacon_type: string | null
  canonical_status: string | null
  religious_institute_name: string | null
  religious_life_type?: string | null
  religious_community_name?: string | null
  religious_province_name?: string | null
  religious_profession_date?: string | null
  religious_canonical_status?: string | null
  ordination_history: AdminOrdinationRecord[]
  clerical_history: AdminClericalHistoryRecord[]
  episcopal_roles: AdminEpiscopalRoleRecord[]
  ecclesiastical_dignities: AdminDignityRecord[]
  can_update_proposal: boolean
  can_approve?: boolean
}

export type CanonicalIdentityProposal = {
  display_name: string
  status: string
  birth_date: string
  birth_place: string
  death_date: string
  biography_public: string
}

export type CanonicalOrdinationProposal = {
  mode: 'keep' | 'set'
  degree: OrdinationDegree
  ordination_date: string
  ordination_place: string
  principal_ordainer_person_id: string
  principal_ordainer_name: string
  assistant_ordainer_1_person_id: string
  assistant_ordainer_1_name: string
  assistant_ordainer_2_person_id: string
  assistant_ordainer_2_name: string
  source_name: string
  source_url: string
  source_checked_at: string
  verification_status: string
  visibility: string
}

export type CanonicalStatusProposal = {
  mode: ProposalMode
  status_type: string
  start_date: string
  end_date: string
  reason: string
  source_name: string
  source_url: string
  source_checked_at: string
  verification_status: string
  visibility: string
}

export type CanonicalIncardinationProposal = {
  mode: ProposalMode
  incardination_entity_id: string
  institute_name: string
  incardination_kind: string
  acquisition_method: string
  start_date: string
  end_date: string
  end_reason: string
  source_name: string
  source_url: string
  source_checked_at: string
  verification_status: string
  visibility: string
}

export type ReligiousLifeProposal = {
  mode: 'keep' | 'set'
  religious_life_type: string
  community_name: string
  province_name: string
  profession_date: string
  canonical_status: string
}

export type EpiscopalRoleProposal = {
  mode: 'keep' | 'set' | 'close_all'
  role_type: string
  jurisdiction_entity_id: string
  title_see_name: string
  start_date: string
  end_date: string
  has_right_of_succession: boolean
  source_name: string
  source_url: string
  source_checked_at: string
  verification_status: string
  visibility: string
}

export type DignityProposal = {
  mode: ProposalMode
  dignity_type: string
  title_text: string
  start_date: string
  end_date: string
  source_name: string
  source_url: string
  source_checked_at: string
  verification_status: string
  visibility: string
}

export type PersonChangeProposalInput = {
  schema_version: 2
  proposal_kind: 'canonical_person'
  identity: CanonicalIdentityProposal
  legacy_profile: {
    priest_type: string
    deacon_type: string
  }
  ordinations: CanonicalOrdinationProposal[]
  canonical_status: CanonicalStatusProposal
  incardination: CanonicalIncardinationProposal
  religious_life: ReligiousLifeProposal
  episcopal_role: EpiscopalRoleProposal
  dignities: DignityProposal[]
}

export type CanonicalEntityOption = {
  id: string
  name: string
  entity_type_key: string | null
}

export type OrdainerOption = {
  id: string
  display_name: string
}

export type PersonCanonicalFormOptions = {
  entities: CanonicalEntityOption[]
  ordainers: OrdainerOption[]
}

export async function getAdminPersonDetail(supabase: SupabaseClient, personId: string) {
  const { data, error } = await supabase.rpc('admin_get_person_detail', {
    p_person_id: personId,
  })

  if (error) throw error
  const firstRow = Array.isArray(data) ? data[0] : null
  if (!firstRow) return null

  const [
    stateResult,
    ordinationResult,
    historyResult,
    roleResult,
    dignityResult,
    religiousResult,
  ] = await Promise.all([
    supabase
      .from('person_current_clerical_state')
      .select('effective_person_type,highest_ordination_degree,ecclesial_condition,canonical_status,incardination_entity_id,incardination_entity_name,incardination_institute_name,incardination_kind')
      .eq('id', personId)
      .maybeSingle(),
    supabase
      .from('person_public_ordination_history')
      .select('degree,ordination_date,ordination_place,principal_ordainer_person_id,principal_ordainer_name,assistant_ordainer_1_person_id,assistant_ordainer_1_name,assistant_ordainer_2_person_id,assistant_ordainer_2_name,source_name,source_url,source_checked_at,verification_status,visibility')
      .eq('person_id', personId)
      .order('ordination_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('person_public_clerical_history')
      .select('dimension_type,dimension_key,display_title,related_entity_id,related_entity_name,start_date,end_date,is_current,has_right_of_succession,detail_text')
      .eq('person_id', personId)
      .order('start_date', { ascending: false, nullsFirst: false }),
    supabase
      .from('person_current_episcopal_roles')
      .select('role_type,jurisdiction_entity_id,jurisdiction_name,title_see_name,start_date,has_right_of_succession')
      .eq('person_id', personId)
      .order('start_date', { ascending: false, nullsFirst: false }),
    supabase
      .from('person_current_ecclesiastical_dignities')
      .select('dignity_type,title_text,start_date')
      .eq('person_id', personId)
      .order('start_date', { ascending: false, nullsFirst: false }),
    supabase
      .from('religious_profiles')
      .select('religious_life_type,community_name,province_name,profession_date,canonical_status')
      .eq('person_id', personId)
      .maybeSingle(),
  ])

  for (const result of [stateResult, ordinationResult, historyResult, roleResult, dignityResult]) {
    if (result.error) throw result.error
  }

  const state = stateResult.data
  const religious = religiousResult.error ? null : religiousResult.data

  return {
    ...firstRow,
    effective_person_type: state?.effective_person_type ?? firstRow.person_type ?? null,
    highest_ordination_degree: state?.highest_ordination_degree ?? null,
    ecclesial_condition: state?.ecclesial_condition ?? null,
    canonical_status: state?.canonical_status ?? firstRow.canonical_status ?? null,
    incardination_entity_id: state?.incardination_entity_id ?? firstRow.incardination_entity_id ?? null,
    incardination_entity_name: state?.incardination_entity_name ?? firstRow.incardination_entity_name ?? null,
    incardination_institute_name: state?.incardination_institute_name ?? null,
    incardination_kind: state?.incardination_kind ?? null,
    religious_life_type: religious?.religious_life_type ?? null,
    religious_community_name: religious?.community_name ?? firstRow.religious_institute_name ?? null,
    religious_province_name: religious?.province_name ?? null,
    religious_profession_date: religious?.profession_date ?? null,
    religious_canonical_status: religious?.canonical_status ?? null,
    ordination_history: (ordinationResult.data ?? []) as AdminOrdinationRecord[],
    clerical_history: (historyResult.data ?? []) as AdminClericalHistoryRecord[],
    episcopal_roles: (roleResult.data ?? []) as AdminEpiscopalRoleRecord[],
    ecclesiastical_dignities: (dignityResult.data ?? []) as AdminDignityRecord[],
  } as AdminPersonDetail
}

export async function getPersonCanonicalFormOptions(supabase: SupabaseClient) {
  const [entityResult, ordainerResult] = await Promise.all([
    supabase
      .from('public_ecclesiastical_entities')
      .select('id,name,entity_type_key')
      .eq('status', 'active')
      .order('name')
      .limit(1000),
    supabase
      .from('person_public_directory')
      .select('id,display_name')
      .eq('has_episcopate', true)
      .order('display_name')
      .limit(500),
  ])

  if (entityResult.error) throw entityResult.error
  if (ordainerResult.error) throw ordainerResult.error

  return {
    entities: (entityResult.data ?? []) as CanonicalEntityOption[],
    ordainers: (ordainerResult.data ?? []) as OrdainerOption[],
  } satisfies PersonCanonicalFormOptions
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
