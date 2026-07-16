import type { SupabaseClient } from '@supabase/supabase-js'

type IncompatibilityQueue = {
  total?: number
}

export async function loadCanonicalIncompatibilityCount(
  supabase: SupabaseClient,
) {
  const { data, error } = await supabase.rpc(
    'admin_list_assignment_canonical_incompatibilities',
    {
      p_status: 'open',
      p_limit: 1,
    },
  )

  if (error) {
    throw new Error(error.message || 'No se pudo consultar la bandeja de incompatibilidades.')
  }

  const queue = data as IncompatibilityQueue | null
  return typeof queue?.total === 'number' ? queue.total : 0
}
