import 'server-only'

import { cache } from 'react'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { loadPublicEntityDetail as loadUncachedPublicEntityDetail } from './entity-detail'
import { loadPublicPersonDetail as loadUncachedPublicPersonDetail } from './person-detail'

export const PUBLIC_DETAIL_REVALIDATE_SECONDS = 900
export const PUBLIC_PERSON_DETAIL_TAG = 'public-person-details'
export const PUBLIC_ENTITY_DETAIL_TAG = 'public-entity-details'

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

export const loadPublicPersonDetail = cache(loadCachedPublicPersonDetail)
export const loadPublicEntityDetail = cache(loadCachedPublicEntityDetail)

type PublicContentInvalidation = {
  personSlug?: string | null
  entitySlug?: string | null
}

export function revalidatePublicContent({ personSlug, entitySlug }: PublicContentInvalidation = {}) {
  revalidateTag(PUBLIC_PERSON_DETAIL_TAG)
  revalidateTag(PUBLIC_ENTITY_DETAIL_TAG)

  revalidatePath('/')
  revalidatePath('/personas')
  revalidatePath('/diocesis')

  if (personSlug) revalidatePath(`/personas/${personSlug}`)
  if (entitySlug) revalidatePath(`/entidades/${entitySlug}`)
}
