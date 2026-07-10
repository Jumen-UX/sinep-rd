import type { SupabaseClient } from '@supabase/supabase-js'

export type SuiIurisChurch = {
  id: string
  official_name: string
  juridic_type: string
  status: string
}

export type JurisdictionTreeRow = {
  entity_id: string
  parent_entity_id: string | null
  depth: number
  path_ids: string[]
  path_names: string[]
  entity_type_key: string
  entity_type_name: string
  name: string
  official_name: string | null
  relationship_key: string | null
  relationship_name: string | null
  jurisdiction_type_key: string | null
  jurisdiction_type_name: string | null
  grouping_type: string | null
  is_metropolitan: boolean
  provincial_role: string | null
  canonical_status: string | null
  status: string
  has_children: boolean
}

export type InternalTreeRow = {
  entity_id: string
  parent_entity_id: string | null
  depth: number
  path_ids: string[]
  path_names: string[]
  entity_type_key: string
  entity_type_name: string
  name: string
  official_name: string | null
  relationship_type: string | null
  status: string
  has_children: boolean
}

export type ProfileRelationship = {
  direction: 'incoming' | 'outgoing'
  relationship_key: string
  relationship_name: string
  entity_id: string
  name: string
  entity_type_key: string
  valid_from: string | null
  valid_to: string | null
  status: string
}

export type ProfileEvent = {
  id: string
  event_type_key: string
  event_type_name: string
  title: string
  event_date: string | null
  effective_date: string | null
  status: string
}

export type JurisdictionProfile = {
  entity?: {
    id: string
    name: string
    official_name: string | null
    slug: string
    description: string | null
    status: string
    entity_type_key: string
    entity_type_name: string
    cathedral_name: string | null
    current_ordinary_name: string | null
    current_ordinary_title: string | null
    territory_summary: string | null
    erected_at: string | null
    suppressed_at: string | null
    source_name: string | null
    source_url: string | null
  }
  jurisdiction?: {
    jurisdiction_type_key?: string
    jurisdiction_type_name?: string
    sui_iuris_church_name?: string
    is_metropolitan?: boolean
    provincial_role?: string
    governance_mode?: string
    canonical_status?: string
    principal_see_city?: string | null
    erection_date?: string | null
    suppression_date?: string | null
  }
  grouping?: {
    grouping_type?: string
    sui_iuris_church_name?: string
    metropolitan_entity_id?: string | null
    metropolitan_name?: string | null
    erection_date?: string | null
    suppression_date?: string | null
    status?: string
  }
  incoming_relationships?: ProfileRelationship[]
  outgoing_relationships?: ProfileRelationship[]
  events?: ProfileEvent[]
}

export async function loadJurisdictionTree(
  supabase: SupabaseClient,
  churchId: string,
  asOfDate: string,
) {
  const [churchResult, treeResult] = await Promise.all([
    supabase
      .from('sui_iuris_churches')
      .select('id,official_name,juridic_type,status')
      .eq('status', 'active')
      .order('official_name'),
    supabase.rpc('get_jurisdiction_tree', {
      p_sui_iuris_church_id: churchId || null,
      p_as_of: asOfDate,
      p_include_historical: false,
    }),
  ])

  const error = churchResult.error ?? treeResult.error
  if (error) throw error

  return {
    churches: (churchResult.data ?? []) as SuiIurisChurch[],
    tree: (treeResult.data ?? []) as JurisdictionTreeRow[],
  }
}

export async function loadJurisdictionDetails(
  supabase: SupabaseClient,
  entityId: string,
  asOfDate: string,
) {
  if (!entityId) return { profile: null, internalTree: [] as InternalTreeRow[] }

  const [profileResult, internalResult] = await Promise.all([
    supabase.rpc('get_jurisdiction_profile', {
      p_entity_id: entityId,
      p_as_of: asOfDate,
    }),
    supabase.rpc('get_entity_internal_tree', {
      p_root_entity_id: entityId,
      p_as_of: asOfDate,
      p_include_historical: false,
    }),
  ])

  const error = profileResult.error ?? internalResult.error
  if (error) throw error

  return {
    profile: (profileResult.data ?? null) as JurisdictionProfile | null,
    internalTree: (internalResult.data ?? []) as InternalTreeRow[],
  }
}
