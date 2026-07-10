import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadAllowedOfficeIds,
  loadClergyPlacementCatalogs,
  type ClergyPlacementCatalogs,
  type OfficeConfig,
} from '../../shared/services/clergy-admin-service'

export type ClergyRecord = {
  id: string
  display_name: string
  slug: string
  person_type: 'priest' | 'bishop'
}

export type BishopCatalogs = ClergyPlacementCatalogs & {
  clergyRecords: ClergyRecord[]
}

export type SaveBishopResponse = {
  person_id?: string
  assignment_id?: string | null
  slug?: string
  error?: string
}

export type { OfficeConfig }
export { loadAllowedOfficeIds }

export async function loadBishopCatalogs(supabase: SupabaseClient): Promise<BishopCatalogs> {
  const [placementCatalogs, clergyResult] = await Promise.all([
    loadClergyPlacementCatalogs(supabase),
    supabase
      .from('persons')
      .select('id,display_name,slug,person_type')
      .in('person_type', ['priest', 'bishop'])
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
