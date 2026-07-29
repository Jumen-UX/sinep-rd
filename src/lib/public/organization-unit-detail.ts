import 'server-only'

import { fetchSupabaseJson } from '@/lib/supabase/rest'

export type PublicOrganizationUnitDetail = {
  id: string
  name: string
  slug: string
  description: string | null
  organization_chart_name: string | null
  organization_chart_key: string | null
  parent_unit_name: string | null
  parent_unit_slug: string | null
  ecclesiastical_entity_name: string | null
  ecclesiastical_entity_slug: string | null
  pastoral_area_name: string | null
  pastoral_area_slug: string | null
  valid_from: string | null
  valid_to: string | null
  is_current: boolean
  status: string
  visibility: string
}

const columns = [
  'id',
  'name',
  'slug',
  'description',
  'organization_chart_name',
  'organization_chart_key',
  'parent_unit_name',
  'parent_unit_slug',
  'ecclesiastical_entity_name',
  'ecclesiastical_entity_slug',
  'pastoral_area_name',
  'pastoral_area_slug',
  'valid_from',
  'valid_to',
  'is_current',
  'status',
  'visibility',
].join(',')

export async function loadUncachedPublicOrganizationUnitDetail(slug: string) {
  const normalizedSlug = slug.trim()
  if (!normalizedSlug) return null

  const rows = await fetchSupabaseJson<PublicOrganizationUnitDetail[]>('public_organization_units', {
    slug: `eq.${normalizedSlug}`,
    status: 'eq.active',
    visibility: 'eq.public',
    select: columns,
    limit: '1',
  })

  return rows[0] ?? null
}
