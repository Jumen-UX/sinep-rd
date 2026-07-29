import 'server-only'

import { cache } from 'react'
import { revalidatePath, unstable_cache } from 'next/cache'
import { PUBLIC_CACHE_TAGS } from './cache-tags'
import { loadPublicEntityDetail as loadUncachedPublicEntityDetail } from './entity-detail'
import { loadUncachedPublicOrganizationUnitDetail } from './organization-unit-detail'
import { loadPublicPersonDetail as loadUncachedPublicPersonDetail } from './person-detail'
import { revalidatePublicCache } from './revalidate'

export const PUBLIC_DETAIL_REVALIDATE_SECONDS = 900
export const PUBLIC_PERSON_DETAIL_TAG = PUBLIC_CACHE_TAGS.directories
export const PUBLIC_ENTITY_DETAIL_TAG = PUBLIC_CACHE_TAGS.directories
export const PUBLIC_ORGANIZATION_UNIT_DETAIL_TAG = PUBLIC_CACHE_TAGS.directories

const loadCachedPublicPersonDetail = unstable_cache(
  async (slug: string) => loadUncachedPublicPersonDetail(slug),
  ['public-person-detail-v1'],
  {
    revalidate: PUBLIC_DETAIL_REVALIDATE_SECONDS,
    tags: [PUBLIC_PERSON_DETAIL_TAG],
  },
)

const loadCachedPublicEntityDetail = unstable_cache(
  async (slug: string) => loadUncachedPublicEntityDetail(slug),
  ['public-entity-detail-v1'],
  {
    revalidate: PUBLIC_DETAIL_REVALIDATE_SECONDS,
    tags: [PUBLIC_ENTITY_DETAIL_TAG],
  },
)

const loadCachedPublicOrganizationUnitDetail = unstable_cache(
  async (slug: string) => loadUncachedPublicOrganizationUnitDetail(slug),
  ['public-organization-unit-detail-v1'],
  {
    revalidate: PUBLIC_DETAIL_REVALIDATE_SECONDS,
    tags: [PUBLIC_ORGANIZATION_UNIT_DETAIL_TAG],
  },
)

export const loadPublicPersonDetail = cache(loadCachedPublicPersonDetail)
export const loadPublicEntityDetail = cache(loadCachedPublicEntityDetail)
export const loadPublicOrganizationUnitDetail = cache(loadCachedPublicOrganizationUnitDetail)

type PublicContentInvalidation = {
  personSlug?: string | null
  entitySlug?: string | null
  organizationUnitSlug?: string | null
}

export function revalidatePublicContent({
  personSlug,
  entitySlug,
  organizationUnitSlug,
}: PublicContentInvalidation = {}) {
  revalidatePublicCache('directories')

  if (personSlug) revalidatePath(`/personas/${personSlug}`)
  if (entitySlug) revalidatePath(`/entidades/${entitySlug}`)
  if (organizationUnitSlug) revalidatePath(`/pastoral/${organizationUnitSlug}`)
}
