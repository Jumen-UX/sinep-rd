import 'server-only'

import { unstable_cache } from 'next/cache'
import { PUBLIC_CACHE_TAGS } from './cache-tags'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

export type PublicJurisdictionStructureNode = {
  node_id: string
  template_id: string
  level_id: string
  level_key: string
  level_name: string
  parent_node_id: string | null
  depth: number
  path_ids: string[]
  path_names: string[]
  name: string
  official_name: string | null
  slug: string | null
  linked_ecclesiastical_entity_id: string | null
  has_children: boolean
}

async function loadUncachedPublicJurisdictionStructure(jurisdictionId: string) {
  const normalizedId = jurisdictionId.trim()
  if (!normalizedId) return []

  return fetchSupabaseJson<PublicJurisdictionStructureNode[]>(
    'rpc/get_public_jurisdiction_structure_tree',
    { p_jurisdiction_id: normalizedId },
  )
}

const loadCachedPublicJurisdictionStructure = unstable_cache(
  loadUncachedPublicJurisdictionStructure,
  ['public-jurisdiction-structure-v1'],
  {
    revalidate: 900,
    tags: [PUBLIC_CACHE_TAGS.directories],
  },
)

export async function loadPublicJurisdictionStructure(jurisdictionId: string) {
  return loadCachedPublicJurisdictionStructure(jurisdictionId)
}
