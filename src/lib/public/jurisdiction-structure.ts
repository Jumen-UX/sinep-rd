import 'server-only'

import { unstable_cache } from 'next/cache'
import { PUBLIC_CACHE_TAGS } from './cache-tags'
import { fetchSupabaseJson } from '@/lib/supabase/rest'

export type PublicJurisdictionStructureNode = {
  account_id: string
  account_code: string
  ecclesiastical_entity_id: string
  slug: string | null
  name: string
  official_name: string | null
  latin_name: string | null
  account_type_key: string
  account_type_name: string
  parent_account_id: string | null
  parent_account_code: string | null
  depth: number
  path_ids: string[]
  path_codes: string[]
  path_names: string[]
  canonical_status: string
  sort_order: number
}

type JurisdictionAccountIdentity = Pick<PublicJurisdictionStructureNode, 'account_id'>

async function loadUncachedPublicJurisdictionStructure(jurisdictionId: string) {
  const normalizedId = jurisdictionId.trim()
  if (!normalizedId) return []

  const accounts = await fetchSupabaseJson<JurisdictionAccountIdentity[]>(
    'public_jurisdiction_account_tree',
    {
      select: 'account_id',
      ecclesiastical_entity_id: `eq.${normalizedId}`,
      limit: '1',
    },
  )
  const rootAccountId = accounts[0]?.account_id
  if (!rootAccountId) return []

  return fetchSupabaseJson<PublicJurisdictionStructureNode[]>(
    'public_jurisdiction_account_tree',
    {
      select: 'account_id,account_code,ecclesiastical_entity_id,slug,name,official_name,latin_name,account_type_key,account_type_name,parent_account_id,parent_account_code,depth,path_ids,path_codes,path_names,canonical_status,sort_order',
      path_ids: `cs.{${rootAccountId}}`,
      order: 'path_codes.asc',
    },
  )
}

const loadCachedPublicJurisdictionStructure = unstable_cache(
  loadUncachedPublicJurisdictionStructure,
  ['public-jurisdiction-account-tree-v3'],
  {
    revalidate: 900,
    tags: [PUBLIC_CACHE_TAGS.directories],
  },
)

export async function loadPublicJurisdictionStructure(jurisdictionId: string) {
  return loadCachedPublicJurisdictionStructure(jurisdictionId)
}
