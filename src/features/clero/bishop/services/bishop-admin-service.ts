import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadAllowedOfficeIds,
  loadClergyPlacementCatalogs,
  type ClergyPlacementCatalogs,
  type OfficeConfig,
} from '../../shared/services/clergy-admin-service'

export type BishopRoleType =
  | 'diocesan'
  | 'auxiliary'
  | 'coadjutor'
  | 'titular'
  | 'emeritus'
  | 'apostolic_administrator'
  | 'apostolic_vicar'
  | 'apostolic_prefect'
  | 'other'

export type ClericalStatusType =
  | 'active'
  | 'retired'
  | 'emeritus'
  | 'suspended'
  | 'restricted'
  | 'inactive'
  | 'deceased'
  | 'lost_clerical_state'
  | 'unknown'

export type EcclesiasticalDignity =
  | 'archbishop'
  | 'metropolitan'
  | 'cardinal'
  | 'monsignor'
  | 'patriarch'
  | 'major_archbishop'
  | 'other'

export type ClergyRecord = {
  id: string
  display_name: string
  slug: string
  highest_ordination_degree: 'presbyterate' | 'episcopate'
}

export type BishopCatalogs = ClergyPlacementCatalogs & {
  clergyRecords: ClergyRecord[]
}

export type SaveBishopResponse = {
  person_id?: string
  assignment_id?: string | null
  episcopal_role_id?: string | null
  slug?: string
  error?: string
}

export type { OfficeConfig }
export { loadAllowedOfficeIds }

export async function loadBishopCatalogs(supabase: SupabaseClient): Promise<BishopCatalogs> {
  const [placementCatalogs, clergyResult] = await Promise.all([
    loadClergyPlacementCatalogs(supabase),
    supabase
      .from('person_ecclesial_state')
      .select('id,display_name,slug,highest_ordination_degree')
      .in('highest_ordination_degree', ['presbyterate', 'episcopate'])
      .eq('status', 'active')
      .order('display_name'),
  ])

  if (clergyResult.error) throw clergyResult.error

  return {
    ...placementCatalogs,
    clergyRecords: (clergyResult.data ?? []) as ClergyRecord[],
  }
}

export async function saveBishop(payload: Record<string, unknown>): Promise<SaveBishopResponse> {
  const response = await fetch('/api/admin/obispo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json() as SaveBishopResponse
  if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar el obispo.')
  return data
}